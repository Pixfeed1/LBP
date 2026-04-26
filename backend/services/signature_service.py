"""Service métier pour la signature électronique."""
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
from sqlalchemy.orm import Session
from loguru import logger

from models import Intervention, Document, InterventionStatus
from models.document import DocumentType, DocumentStatus
from config import settings
from services.pdf_generation import generate_all_pdfs_for_intervention
from services.sms_service import send_sms_twilio, build_signature_sms_message


def generate_signature_token() -> str:
    """Génère un token unique cryptographiquement sûr."""
    return secrets.token_urlsafe(32)


def get_signature_url(token: str) -> str:
    """Construit l'URL publique de signature à partir du token."""
    base = settings.APP_URL.rstrip("/")
    return f"{base}/signature/{token}"


def get_documents_for_intervention(intervention: Intervention) -> List[DocumentType]:
    """
    Détermine quels documents sont nécessaires pour une intervention.
    Pour LBP : toujours PV + Fiche travaux.
    Si logement +2 ans : Attestation TVA en plus.
    Si délégation paiement (mutuelle/assurance) : Délégation paiement.
    """
    docs = [DocumentType.PROCES_VERBAL, DocumentType.FICHE_TRAVAUX]
    
    if intervention.logement_plus_2_ans == "Y":
        docs.append(DocumentType.ATTESTATION_TVA)
    
    return docs


def prepare_signature_workflow(
    db: Session,
    intervention: Intervention,
    provider: str = "maison",
    document_types: Optional[List[DocumentType]] = None,
    expires_in_days: int = 7,
) -> dict:
    """
    Prépare le workflow signature :
    1. Génère un token unique
    2. Crée les entrées Document en DB (avec placeholders chemins fichiers)
    3. Met à jour le statut de l'intervention
    
    Retourne un dict avec token, url, expires_at, documents.
    """
    # 1. Token + expiration
    token = generate_signature_token()
    expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
    
    # 2. Déterminer les documents à générer
    types_to_generate = document_types or get_documents_for_intervention(intervention)
    
    # 3. Supprimer les anciens documents (au cas où on renvoie)
    db.query(Document).filter(Document.intervention_id == intervention.id).delete()
    db.commit()
    
    # 4. Créer les nouveaux documents (placeholders pour l'instant — pas de PDF généré)
    documents = []
    storage_dir = Path("/app/storage/documents") / str(intervention.id)
    
    for doc_type in types_to_generate:
        document = Document(
            intervention_id=intervention.id,
            type=doc_type,
            status=DocumentStatus.PENDING,
            signature_provider=provider,
            # Chemins prévisionnels (les fichiers seront générés à la prochaine étape)
            file_path_unsigned=str(storage_dir / f"{doc_type.value}_unsigned.pdf"),
        )
        db.add(document)
        documents.append(document)
    
    # 5. Mettre à jour l'intervention
    intervention.signature_token = token
    intervention.signature_link_expires_at = expires_at
    intervention.status = InterventionStatus.SENT
    
    db.commit()
    for doc in documents:
        db.refresh(doc)
    db.refresh(intervention)
    
    # 6. Générer les vrais PDFs maintenant
    pdf_result = generate_all_pdfs_for_intervention(intervention, documents)
    db.commit()  # Sauvegarder les chemins mis à jour
    for doc in documents:
        db.refresh(doc)
    
    logger.info(f"PDFs : {pdf_result['generated']}/{pdf_result['total']} générés")
    
    # Envoi du SMS au client
    sms_sent = False
    sms_error = None
    try:
        client_name = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip()
        if not client_name:
            client_name = "Madame, Monsieur"
        signature_url = get_signature_url(token)
        message = build_signature_sms_message(client_name, signature_url)
        sms_result = send_sms_twilio(
            intervention.client_telephone,
            message,
            db=db,
            intervention_id=intervention.id,
        )
        sms_sent = True
        logger.info(f"SMS envoyé à {intervention.client_telephone} (SID: {sms_result.get('sid')})")
    except Exception as e:
        sms_error = str(e)
        logger.error(f"Échec envoi SMS : {e}")

    logger.info(
        f"Signature workflow préparé : intervention={intervention.id}, "
        f"token={token[:10]}..., {len(documents)} documents, provider={provider}"
    )
    
    return {
        "intervention_id": intervention.id,
        "signature_token": token,
        "signature_url": get_signature_url(token),
        "expires_at": expires_at,
        "documents_generated": len(documents),
        "documents": documents,
        "sms_sent": sms_sent,
        "sms_error": sms_error,
    }
