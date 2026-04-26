"""Routes publiques de signature — accessibles SANS authentification.

Workflow :
1. Client clique sur le SMS → arrive sur /signature/{token}
2. Frontend appelle GET /api/public/signature/{token} pour valider
3. Frontend affiche les PDFs (download via GET /api/public/signature/{token}/document/{doc_id})
4. Client signe → POST /api/public/signature/{token}/sign
"""
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from loguru import logger

from database import get_db
from models import (
    Intervention, InterventionStatus,
    Document, DocumentStatus, DocumentType,
    Signature, SignatureStatus,
)

router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class PublicDocumentInfo(BaseModel):
    id: str
    type: str
    status: str

    class Config:
        from_attributes = True


class PublicSignatureInfo(BaseModel):
    """Données publiques d'un workflow de signature (vue limitée pour le client)."""
    intervention_id: str
    client_nom: str
    client_prenom: str
    client_adresse: Optional[str] = None
    client_code_postal: Optional[str] = None
    client_ville: Optional[str] = None
    description_travaux: Optional[str] = None
    montant_devis_ht: Optional[int] = None
    montant_devis_ttc: Optional[int] = None
    date_rdv: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_signed: bool = False
    documents: List[PublicDocumentInfo] = []


class SignRequest(BaseModel):
    signature_image: str = Field(min_length=100, description="Canvas signature en base64 PNG (data URL)")
    signer_name_typed: str = Field(min_length=2, max_length=255, description="Nom retapé par le client")
    consent_text: str = Field(min_length=5, max_length=500, description="Mention manuscrite saisie")


class SignResponse(BaseModel):
    success: bool
    intervention_id: str
    signed_at: datetime
    documents_signed: int
    message: str


# ============================================================
# HELPERS
# ============================================================

def get_intervention_by_token(db: Session, token: str) -> Intervention:
    """Récupère l'intervention via son token signature, valide expiration et status."""
    intervention = db.query(Intervention).filter(
        Intervention.signature_token == token
    ).first()

    if not intervention:
        raise HTTPException(status_code=404, detail="Lien de signature invalide")

    if intervention.signature_link_expires_at and intervention.signature_link_expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Lien de signature expiré")

    return intervention


def get_client_ip(request: Request) -> str:
    """Récupère l'IP client (gère proxy / Cloudflare / Apache)."""
    # X-Forwarded-For peut contenir une chaîne d'IPs
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "0.0.0.0"


# ============================================================
# ROUTES
# ============================================================

@router.get("/{token}", response_model=PublicSignatureInfo)
async def get_signature_info(token: str, db: Session = Depends(get_db)):
    """Vérifie le token et retourne les infos du workflow de signature.
    Cette route est PUBLIQUE (pas d'auth)."""
    intervention = get_intervention_by_token(db, token)

    documents = db.query(Document).filter(
        Document.intervention_id == intervention.id
    ).all()

    is_signed = intervention.status == InterventionStatus.SIGNED

    return PublicSignatureInfo(
        intervention_id=str(intervention.id),
        client_nom=intervention.client_nom,
        client_prenom=intervention.client_prenom,
        client_adresse=intervention.client_adresse,
        client_code_postal=intervention.client_code_postal,
        client_ville=intervention.client_ville,
        description_travaux=intervention.description_travaux,
        montant_devis_ht=intervention.montant_devis_ht,
        montant_devis_ttc=intervention.montant_devis_ttc,
        date_rdv=intervention.date_rdv,
        expires_at=intervention.signature_link_expires_at,
        is_signed=is_signed,
        documents=[
            PublicDocumentInfo(
                id=str(d.id),
                type=d.type.value,
                status=d.status.value,
            ) for d in documents
        ],
    )


@router.get("/{token}/document/{document_id}")
async def download_document_public(
    token: str,
    document_id: UUID,
    db: Session = Depends(get_db)
):
    """Télécharge un PDF (vue ou signé) — accessible publiquement via le token."""
    intervention = get_intervention_by_token(db, token)

    document = db.query(Document).filter(
        Document.id == document_id,
        Document.intervention_id == intervention.id
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Si signé, on retourne le signed sinon le unsigned
    file_path = document.file_path_signed or document.file_path_unsigned

    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=404, detail="Fichier PDF non disponible")

    filename = f"{document.type.value}_{intervention.client_nom}.pdf"
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.post("/{token}/sign", response_model=SignResponse)
async def sign_documents(
    token: str,
    payload: SignRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Signe TOUS les documents de l'intervention.
    
    - Capture IP + user-agent
    - Calcule hash SHA256 (signature + mention + IP + timestamp)
    - Crée une entrée Signature par document
    - Met à jour l'intervention en SIGNED
    """
    intervention = get_intervention_by_token(db, token)

    # Vérifier qu'on n'a pas déjà signé
    if intervention.status == InterventionStatus.SIGNED:
        raise HTTPException(status_code=409, detail="Cette intervention est déjà signée")

    documents = db.query(Document).filter(
        Document.intervention_id == intervention.id
    ).all()

    if not documents:
        raise HTTPException(status_code=400, detail="Aucun document à signer")

    # Capture des preuves juridiques
    signed_at = datetime.utcnow()
    signer_ip = get_client_ip(request)
    signer_user_agent = request.headers.get("user-agent", "unknown")[:500]

    # Hash unique : signature + mention + IP + timestamp + intervention_id
    hash_input = f"{payload.signature_image[:200]}|{payload.consent_text}|{payload.signer_name_typed}|{signer_ip}|{signed_at.isoformat()}|{intervention.id}"
    hash_sha256 = hashlib.sha256(hash_input.encode("utf-8")).hexdigest()

    metadata = {
        "intervention_id": str(intervention.id),
        "client_nom": intervention.client_nom,
        "client_prenom": intervention.client_prenom,
        "signer_ip": signer_ip,
        "signer_user_agent": signer_user_agent,
        "documents_count": len(documents),
        "timestamp_utc": signed_at.isoformat(),
    }

    # Créer une signature par document
    signatures_created = 0
    for doc in documents:
        signature = Signature(
            intervention_id=intervention.id,
            document_id=doc.id,
            status=SignatureStatus.SIGNED,
            signature_image=payload.signature_image,
            signed_at=signed_at,
            signer_ip=signer_ip,
            signer_user_agent=signer_user_agent,
            signer_name_typed=payload.signer_name_typed,
            signer_consent_text=payload.consent_text,
            hash_sha256=hash_sha256,
            provider="maison",
            metadata_json=metadata,
        )
        db.add(signature)

        # Mettre à jour le document
        doc.status = DocumentStatus.SIGNED
        doc.signed_at = signed_at

        signatures_created += 1

    # Mettre à jour l'intervention
    intervention.status = InterventionStatus.SIGNED
    db.commit()

    # Incruster les signatures dans les PDFs (try/except : ne fait pas échouer la signature)
    try:
        from services.pdf_signing import sign_intervention_documents
        sign_result = sign_intervention_documents(db, intervention.id)
        logger.info(
            f"📝 PDFs incrustés : {sign_result['signed']}/{sign_result['total']} "
            f"({sign_result['errors']} erreurs)"
        )
    except Exception as e:
        logger.exception(f"⚠️ Incrustation PDF échouée pour intervention {intervention.id} : {e}")
        # On continue : la signature en DB reste valide, on pourra rejouer le script rétro

    logger.info(
        f"✅ Signature OK : intervention={intervention.id}, "
        f"{signatures_created} docs signés, IP={signer_ip}, hash={hash_sha256[:16]}..."
    )

    return SignResponse(
        success=True,
        intervention_id=str(intervention.id),
        signed_at=signed_at,
        documents_signed=signatures_created,
        message="Documents signés avec succès",
    )
