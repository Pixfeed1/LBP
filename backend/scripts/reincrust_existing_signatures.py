"""
Script rétro : régénère les PDFs signés pour les signatures existantes.

Usage :
    # Dry-run : liste ce qui serait fait, sans modifier
    python scripts/reincrust_existing_signatures.py --dry-run

    # Cibler une seule intervention
    python scripts/reincrust_existing_signatures.py --intervention <uuid>

    # Cibler une intervention en dry-run
    python scripts/reincrust_existing_signatures.py --intervention <uuid> --dry-run

    # Toutes les signatures (production)
    python scripts/reincrust_existing_signatures.py

Idempotent : peut être relancé N fois, regenère systématiquement file_path_signed
depuis file_path_unsigned.
"""
import argparse
import sys
from pathlib import Path

# Ajouter le parent au path pour les imports relatifs
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import distinct
from loguru import logger

from database import SessionLocal
from models import Intervention, Document, Signature, InterventionStatus


def main():
    parser = argparse.ArgumentParser(description="Re-incruste les signatures dans les PDFs existants")
    parser.add_argument("--dry-run", action="store_true", help="Liste les actions sans modifier")
    parser.add_argument("--intervention", type=str, default=None, help="UUID d'une intervention spécifique")
    args = parser.parse_args()

    db = SessionLocal()

    # Récupérer les interventions à traiter
    query = db.query(Intervention).filter(
        Intervention.status == InterventionStatus.SIGNED
    )
    if args.intervention:
        query = query.filter(Intervention.id == args.intervention)

    interventions = query.all()

    if not interventions:
        print("⚠️  Aucune intervention signée trouvée")
        return 1

    print(f"\n{'='*60}")
    print(f"  RE-INCRUSTATION SIGNATURES — {'DRY-RUN' if args.dry_run else 'EXECUTION'}")
    print(f"{'='*60}")
    print(f"  Interventions à traiter : {len(interventions)}\n")

    total_docs = 0
    total_signed = 0
    total_errors = 0
    total_skipped = 0

    for intervention in interventions:
        client = f"{intervention.client_prenom} {intervention.client_nom}".strip()
        print(f"📋 {intervention.id} — {client}")

        documents = db.query(Document).filter(
            Document.intervention_id == intervention.id
        ).all()

        for doc in documents:
            doc_type = doc.type.value if hasattr(doc.type, "value") else doc.type
            unsigned_exists = doc.file_path_unsigned and Path(doc.file_path_unsigned).exists()
            already_signed = bool(doc.file_path_signed)
            signature = db.query(Signature).filter(Signature.document_id == doc.id).first()

            status_str = "  └─"
            if not unsigned_exists:
                status_str += f" ❌ {doc_type}: unsigned introuvable"
                total_errors += 1
            elif not signature:
                status_str += f" ⚠️  {doc_type}: pas de signature en DB"
                total_skipped += 1
            else:
                action = "REGEN" if already_signed else "GEN  "
                status_str += f" 🔄 {doc_type}: {action} (image {len(signature.signature_image or '')//1024}KB)"
                total_signed += 1

            print(status_str)
            total_docs += 1

        # Incrustation réelle si pas dry-run
        if not args.dry_run:
            from services.pdf_signing import sign_intervention_documents
            result = sign_intervention_documents(db, intervention.id)
            print(f"  ✅ Résultat : {result['signed']}/{result['total']} signés, {result['errors']} erreurs\n")

    print(f"\n{'='*60}")
    print(f"  RÉCAPITULATIF")
    print(f"{'='*60}")
    print(f"  Documents totaux  : {total_docs}")
    print(f"  À (re)signer      : {total_signed}")
    print(f"  Skipped (no sig)  : {total_skipped}")
    print(f"  Erreurs           : {total_errors}")
    print()

    if args.dry_run:
        print("  💡 Lance sans --dry-run pour exécuter réellement.")
    else:
        print("  ✅ Terminé. Vérifie les fichiers _signed.pdf dans storage/documents/")

    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
