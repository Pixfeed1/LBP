"""Routes pour la gestion et le téléchargement des documents."""
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models import User, Document
from utils.dependencies import get_current_user


router = APIRouter()


@router.get("/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Télécharger un PDF (signé ou non selon disponibilité)."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document introuvable")
    
    # Privilégier le PDF signé s'il existe
    file_path = document.file_path_signed or document.file_path_unsigned
    if not file_path:
        raise HTTPException(status_code=404, detail="Fichier non généré")
    
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Fichier introuvable sur le disque : {file_path}"
        )
    
    # Nom du fichier de téléchargement
    filename = f"{document.type.value}_{document.intervention_id}.pdf"
    
    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/by-intervention/{intervention_id}")
async def list_documents_by_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Liste les documents d'une intervention."""
    docs = db.query(Document).filter(Document.intervention_id == intervention_id).all()
    return [
        {
            "id": str(d.id),
            "type": d.type.value,
            "status": d.status.value,
            "signature_provider": d.signature_provider,
            "file_path_unsigned": d.file_path_unsigned,
            "file_path_signed": d.file_path_signed,
            "has_unsigned_file": bool(d.file_path_unsigned and Path(d.file_path_unsigned).exists()),
            "has_signed_file": bool(d.file_path_signed and Path(d.file_path_signed).exists()),
            "created_at": d.created_at.isoformat(),
            "signed_at": d.signed_at.isoformat() if d.signed_at else None,
        }
        for d in docs
    ]



# ============================================================
# Routes ajoutées : liste globale documents + stats
# ============================================================

from datetime import datetime, timedelta
from typing import List
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload
from pydantic import BaseModel
from models.document import DocumentStatus


class DocumentItem(BaseModel):
    id: str
    intervention_id: str
    type: str
    status: str
    file_path_unsigned: str | None = None
    file_path_signed: str | None = None
    has_signed_file: bool = False
    signature_provider: str = "maison"
    signed_at: datetime | None = None
    created_at: datetime

    # Pour affichage
    client_nom: str | None = None
    client_prenom: str | None = None
    client_telephone: str | None = None

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    items: List[DocumentItem]
    total: int
    page: int
    page_size: int
    pages: int


class DocumentStats(BaseModel):
    total: int
    signed: int
    pending: int
    sent: int
    rejected: int
    expired: int
    signed_today: int
    signed_week: int
    signed_month: int
    by_type: dict


@router.get("/stats", response_model=DocumentStats)
async def get_documents_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stats globales des documents."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    total = db.query(func.count(Document.id)).scalar() or 0
    signed = db.query(func.count(Document.id)).filter(Document.status == DocumentStatus.SIGNED).scalar() or 0
    pending = db.query(func.count(Document.id)).filter(Document.status == DocumentStatus.PENDING).scalar() or 0
    sent = db.query(func.count(Document.id)).filter(Document.status == DocumentStatus.SENT).scalar() or 0
    rejected = db.query(func.count(Document.id)).filter(Document.status == DocumentStatus.REJECTED).scalar() or 0
    expired = db.query(func.count(Document.id)).filter(Document.status == DocumentStatus.EXPIRED).scalar() or 0

    signed_today = db.query(func.count(Document.id)).filter(
        Document.status == DocumentStatus.SIGNED,
        Document.signed_at >= today_start,
    ).scalar() or 0

    signed_week = db.query(func.count(Document.id)).filter(
        Document.status == DocumentStatus.SIGNED,
        Document.signed_at >= week_start,
    ).scalar() or 0

    signed_month = db.query(func.count(Document.id)).filter(
        Document.status == DocumentStatus.SIGNED,
        Document.signed_at >= month_start,
    ).scalar() or 0

    # Distribution par type
    by_type_rows = db.query(Document.type, func.count(Document.id)).group_by(Document.type).all()
    by_type = {
        (t.value if hasattr(t, "value") else str(t)): count
        for t, count in by_type_rows
    }

    return DocumentStats(
        total=total,
        signed=signed,
        pending=pending,
        sent=sent,
        rejected=rejected,
        expired=expired,
        signed_today=signed_today,
        signed_week=signed_week,
        signed_month=signed_month,
        by_type=by_type,
    )


@router.get("", response_model=DocumentListResponse)
async def list_all_documents(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = None,
    doc_type: str | None = None,
    only_signed: bool = False,
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste paginee de tous les documents."""
    from pathlib import Path as _Path

    query = db.query(Document).options(joinedload(Document.intervention))

    if only_signed:
        query = query.filter(Document.status == DocumentStatus.SIGNED)

    if status:
        query = query.filter(Document.status == status)

    if doc_type:
        query = query.filter(Document.type == doc_type)

    if search:
        like = f"%{search}%"
        query = query.join(Intervention, Document.intervention_id == Intervention.id).filter(
            or_(
                Intervention.client_nom.ilike(like),
                Intervention.client_prenom.ilike(like),
                Intervention.client_telephone.ilike(like),
            )
        )

    if date_from:
        try:
            df = datetime.fromisoformat(date_from)
            query = query.filter(Document.created_at >= df)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.fromisoformat(date_to) + timedelta(days=1)
            query = query.filter(Document.created_at < dt)
        except ValueError:
            pass

    query = query.order_by(Document.created_at.desc())

    total = query.count()
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    offset = (page - 1) * page_size

    rows = query.offset(offset).limit(page_size).all()

    items = []
    for doc in rows:
        # Vérif que le fichier signé existe vraiment sur disque
        has_signed = bool(doc.file_path_signed and _Path(doc.file_path_signed).exists())

        items.append(DocumentItem(
            id=str(doc.id),
            intervention_id=str(doc.intervention_id),
            type=doc.type.value if hasattr(doc.type, "value") else str(doc.type),
            status=doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            file_path_unsigned=doc.file_path_unsigned,
            file_path_signed=doc.file_path_signed,
            has_signed_file=has_signed,
            signature_provider=doc.signature_provider or "maison",
            signed_at=doc.signed_at,
            created_at=doc.created_at,
            client_nom=doc.intervention.client_nom if doc.intervention else None,
            client_prenom=doc.intervention.client_prenom if doc.intervention else None,
            client_telephone=doc.intervention.client_telephone if doc.intervention else None,
        ))

    return DocumentListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
