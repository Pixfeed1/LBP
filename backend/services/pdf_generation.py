"""
Service d'orchestration de génération des PDFs.
Utilise pdf_filler.py existant (du projet 1) avec mapping Intervention -> client_data.
"""
from pathlib import Path
from typing import List, Optional
from datetime import datetime
from loguru import logger

from models import Intervention, Document
from models.document import DocumentType, DocumentStatus
from services import pdf_filler


# Répertoires
TEMPLATES_DIR = Path("/app/pdf_templates")
STORAGE_DIR = Path("/app/storage/documents")


def intervention_to_client_data(intervention: Intervention) -> dict:
    """Convertit une Intervention en client_data attendu par pdf_filler."""
    date_str = intervention.date_rdv.strftime("%d/%m/%Y") if intervention.date_rdv else datetime.now().strftime("%d/%m/%Y")
    
    # Reference courte basee sur l'UUID de l'intervention
    ref_short = str(intervention.id)[:8].upper()
    return {
        "reference_intervention": f"LBP-{ref_short}",
        "nom": intervention.client_nom or "",
        "prenom": intervention.client_prenom or "",
        "telephone": intervention.client_telephone or "",
        "email": intervention.client_email or "",
        "adresse": intervention.client_adresse or "",
        "code_postal": intervention.client_code_postal or "",
        "ville": intervention.client_ville or "",
        "date_rdv": date_str,
        # Champs spécifiques projet 1 — laissés vides pour LBP v2
        "sinistre": "",
        "compagnie": "",
        "description_travaux": intervention.description_travaux or "",
        "montant_ht": f"{intervention.montant_devis_ht / 100:.2f}" if intervention.montant_devis_ht else "",
        "montant_ttc": f"{intervention.montant_devis_ttc / 100:.2f}" if intervention.montant_devis_ttc else "0,00",
        "montant_tva": f"{(intervention.montant_devis_ttc - intervention.montant_devis_ht) / 100:.2f}" if intervention.montant_devis_ttc and intervention.montant_devis_ht else "0,00",
        "compagnie": "",  # Pas de compagnie en projet 2 (sauf si fourni dans description Google Cal)
        "sinistre": "",   # Pas de N° sinistre par défaut
        "reference_ma": "",  # Pas de Ref MA par défaut
    }


def get_template_path(doc_type: DocumentType) -> Optional[Path]:
    """Retourne le chemin du template PDF pour un type de document."""
    mapping = {
        DocumentType.ATTESTATION_TVA: TEMPLATES_DIR / "attestation_tva.pdf",
        DocumentType.PROCES_VERBAL: TEMPLATES_DIR / "proces_verbal.pdf",
        DocumentType.DELEGATION_PAIEMENT: TEMPLATES_DIR / "delegation_paiement.pdf",
        DocumentType.FICHE_TRAVAUX: TEMPLATES_DIR / "fiche_travaux.pdf",
    }
    path = mapping.get(doc_type)
    if path and path.exists():
        return path
    return None


def generate_pdf_for_document(document: Document, intervention: Intervention) -> bool:
    """
    Génère le PDF pour un document donné.
    Retourne True si succès, False sinon.
    """
    template = get_template_path(document.type)
    if not template:
        logger.warning(f"Template introuvable pour {document.type.value}")
        return False
    
    # Créer le dossier de stockage
    output_dir = STORAGE_DIR / str(intervention.id)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    output_path = output_dir / f"{document.type.value}_unsigned.pdf"
    client_data = intervention_to_client_data(intervention)
    
    try:
        if document.type == DocumentType.ATTESTATION_TVA:
            pdf_filler.fill_attestation_tva(str(template), client_data, str(output_path))
        elif document.type == DocumentType.PROCES_VERBAL:
            from services.proces_verbal_generator import generate_proces_verbal_pdf
            generate_proces_verbal_pdf(client_data, str(output_path))
        elif document.type == DocumentType.DELEGATION_PAIEMENT:
            from services.delegation_paiement_generator import generate_delegation_pdf
            generate_delegation_pdf(client_data, str(output_path))
        elif document.type == DocumentType.FICHE_TRAVAUX:
            from services.fiche_travaux_generator import generate_fiche_travaux_pdf
            generate_fiche_travaux_pdf(client_data, str(output_path))
        else:
            logger.warning(f"Type de document non géré : {document.type.value}")
            return False
        
        # Mettre à jour le chemin réel
        document.file_path_unsigned = str(output_path)
        logger.info(f"PDF généré : {output_path}")
        return True
        
    except Exception as e:
        logger.error(f"Erreur génération PDF {document.type.value} : {e}")
        return False


def generate_all_pdfs_for_intervention(intervention: Intervention, documents: List[Document]) -> dict:
    """
    Génère tous les PDFs pour les documents d'une intervention.
    Retourne un résumé : {generated: N, failed: M, paths: [...]}
    """
    generated = 0
    failed = 0
    paths = []
    
    for doc in documents:
        if generate_pdf_for_document(doc, intervention):
            generated += 1
            paths.append(doc.file_path_unsigned)
        else:
            failed += 1
    
    return {
        "generated": generated,
        "failed": failed,
        "total": len(documents),
        "paths": paths,
    }
