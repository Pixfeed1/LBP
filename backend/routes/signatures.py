"""Routes de gestion des signatures (audit trail / preuves juridiques)."""
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Intervention, Document, Signature, SignatureStatus
from utils.dependencies import get_current_user
from models.user import User

router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class SignatureItem(BaseModel):
    id: str
    intervention_id: str
    document_id: str
    document_type: str
    status: str

    # Preuves juridiques
    signed_at: Optional[datetime] = None
    signer_ip: Optional[str] = None
    signer_user_agent: Optional[str] = None
    signer_name_typed: Optional[str] = None
    signer_consent_text: Optional[str] = None
    hash_sha256: Optional[str] = None

    # Pour affichage
    client_nom: Optional[str] = None
    client_prenom: Optional[str] = None
    client_telephone: Optional[str] = None
    intervention_status: Optional[str] = None

    # Image (uniquement renvoyée si demandée explicitement avec ?include_image=true)
    signature_image: Optional[str] = None

    class Config:
        from_attributes = True


class SignatureListResponse(BaseModel):
    items: List[SignatureItem]
    total: int
    page: int
    page_size: int
    pages: int


class SignatureStats(BaseModel):
    total_signatures: int
    signed_today: int
    signed_week: int
    signed_month: int
    unique_clients_signed: int
    interventions_signed: int
    interventions_total: int
    signature_rate: float  # 0-100


# ============================================================
# ROUTES
# ============================================================

@router.get("/stats", response_model=SignatureStats)
async def get_signature_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Statistiques globales des signatures."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    total_sigs = db.query(func.count(Signature.id)).filter(
        Signature.status == SignatureStatus.SIGNED
    ).scalar() or 0

    signed_today = db.query(func.count(Signature.id)).filter(
        Signature.status == SignatureStatus.SIGNED,
        Signature.signed_at >= today_start,
    ).scalar() or 0

    signed_week = db.query(func.count(Signature.id)).filter(
        Signature.status == SignatureStatus.SIGNED,
        Signature.signed_at >= week_start,
    ).scalar() or 0

    signed_month = db.query(func.count(Signature.id)).filter(
        Signature.status == SignatureStatus.SIGNED,
        Signature.signed_at >= month_start,
    ).scalar() or 0

    # Nombre d'interventions distinctes signées
    interventions_signed = db.query(func.count(func.distinct(Signature.intervention_id))).filter(
        Signature.status == SignatureStatus.SIGNED
    ).scalar() or 0

    # Total interventions (toutes statuts confondus)
    interventions_total = db.query(func.count(Intervention.id)).scalar() or 0

    # Clients uniques (distinct par intervention.client_telephone)
    unique_clients = db.query(
        func.count(func.distinct(Intervention.client_telephone))
    ).join(
        Signature, Signature.intervention_id == Intervention.id
    ).filter(
        Signature.status == SignatureStatus.SIGNED
    ).scalar() or 0

    rate = (interventions_signed / interventions_total * 100) if interventions_total > 0 else 0.0

    return SignatureStats(
        total_signatures=total_sigs,
        signed_today=signed_today,
        signed_week=signed_week,
        signed_month=signed_month,
        unique_clients_signed=unique_clients,
        interventions_signed=interventions_signed,
        interventions_total=interventions_total,
        signature_rate=round(rate, 1),
    )


@router.get("", response_model=SignatureListResponse)
async def list_signatures(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    date_from: Optional[str] = None,  # ISO date
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste paginée des signatures (1 entrée par doc signé)."""
    query = db.query(Signature).options(
        joinedload(Signature.intervention),
        joinedload(Signature.document),
    ).filter(Signature.status == SignatureStatus.SIGNED)

    # Filtres
    if search:
        like = f"%{search}%"
        query = query.join(Intervention, Signature.intervention_id == Intervention.id).filter(
            or_(
                Intervention.client_nom.ilike(like),
                Intervention.client_prenom.ilike(like),
                Intervention.client_telephone.ilike(like),
                Signature.signer_name_typed.ilike(like),
                Signature.signer_ip.ilike(like),
            )
        )

    if date_from:
        try:
            df = datetime.fromisoformat(date_from)
            query = query.filter(Signature.signed_at >= df)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            # Inclure toute la journée
            dt = dt + timedelta(days=1)
            query = query.filter(Signature.signed_at < dt)
        except ValueError:
            pass

    # Tri : plus récent d'abord
    query = query.order_by(Signature.signed_at.desc().nullslast())

    total = query.count()
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    offset = (page - 1) * page_size

    signatures = query.offset(offset).limit(page_size).all()

    items = []
    for sig in signatures:
        items.append(SignatureItem(
            id=str(sig.id),
            intervention_id=str(sig.intervention_id),
            document_id=str(sig.document_id),
            document_type=sig.document.type.value if sig.document else "unknown",
            status=sig.status.value if hasattr(sig.status, "value") else str(sig.status),
            signed_at=sig.signed_at,
            signer_ip=sig.signer_ip,
            signer_user_agent=sig.signer_user_agent,
            signer_name_typed=sig.signer_name_typed,
            signer_consent_text=sig.signer_consent_text,
            hash_sha256=sig.hash_sha256,
            client_nom=sig.intervention.client_nom if sig.intervention else None,
            client_prenom=sig.intervention.client_prenom if sig.intervention else None,
            client_telephone=sig.intervention.client_telephone if sig.intervention else None,
            intervention_status=sig.intervention.status.value if sig.intervention and hasattr(sig.intervention.status, "value") else None,
            signature_image=None,  # On ne renvoie pas l'image dans la liste (trop lourd)
        ))

    return SignatureListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{signature_id}", response_model=SignatureItem)
async def get_signature_detail(
    signature_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Détail complet d'une signature (avec image canvas)."""
    sig = db.query(Signature).options(
        joinedload(Signature.intervention),
        joinedload(Signature.document),
    ).filter(Signature.id == signature_id).first()

    if not sig:
        raise HTTPException(status_code=404, detail="Signature non trouvée")

    return SignatureItem(
        id=str(sig.id),
        intervention_id=str(sig.intervention_id),
        document_id=str(sig.document_id),
        document_type=sig.document.type.value if sig.document else "unknown",
        status=sig.status.value if hasattr(sig.status, "value") else str(sig.status),
        signed_at=sig.signed_at,
        signer_ip=sig.signer_ip,
        signer_user_agent=sig.signer_user_agent,
        signer_name_typed=sig.signer_name_typed,
        signer_consent_text=sig.signer_consent_text,
        hash_sha256=sig.hash_sha256,
        client_nom=sig.intervention.client_nom if sig.intervention else None,
        client_prenom=sig.intervention.client_prenom if sig.intervention else None,
        client_telephone=sig.intervention.client_telephone if sig.intervention else None,
        intervention_status=sig.intervention.status.value if sig.intervention and hasattr(sig.intervention.status, "value") else None,
        signature_image=sig.signature_image,  # Image complète ici
    )
