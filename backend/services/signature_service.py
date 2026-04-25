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
        "sms_to_send": True,
    }
