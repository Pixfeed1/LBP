"""Routes de gestion des SMS (historique + stats)."""
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Intervention, SmsLog, SmsStatus
from utils.dependencies import get_current_user
from models.user import User

router = APIRouter()


class SmsItem(BaseModel):
    id: str
    intervention_id: Optional[str] = None
    phone: str
    message: str
    sms_type: str
    status: str

    twilio_sid: Optional[str] = None
    error_message: Optional[str] = None

    sent_at: datetime
    delivered_at: Optional[datetime] = None

    # Pour affichage
    client_nom: Optional[str] = None
    client_prenom: Optional[str] = None

    class Config:
        from_attributes = True


class SmsListResponse(BaseModel):
    items: List[SmsItem]
    total: int
    page: int
    page_size: int
    pages: int


class SmsStats(BaseModel):
    total: int
    sent: int
    delivered: int
    failed: int
    sent_today: int
    sent_week: int
    sent_month: int
    success_rate: float  # %


@router.get("/stats", response_model=SmsStats)
async def get_sms_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stats globales des SMS envoyés."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    total = db.query(func.count(SmsLog.id)).scalar() or 0
    sent = db.query(func.count(SmsLog.id)).filter(SmsLog.status == SmsStatus.SENT).scalar() or 0
    delivered = db.query(func.count(SmsLog.id)).filter(SmsLog.status == SmsStatus.DELIVERED).scalar() or 0
    failed = db.query(func.count(SmsLog.id)).filter(SmsLog.status == SmsStatus.FAILED).scalar() or 0

    sent_today = db.query(func.count(SmsLog.id)).filter(SmsLog.sent_at >= today_start).scalar() or 0
    sent_week = db.query(func.count(SmsLog.id)).filter(SmsLog.sent_at >= week_start).scalar() or 0
    sent_month = db.query(func.count(SmsLog.id)).filter(SmsLog.sent_at >= month_start).scalar() or 0

    success_count = sent + delivered
    success_rate = (success_count / total * 100) if total > 0 else 0.0

    return SmsStats(
        total=total,
        sent=sent,
        delivered=delivered,
        failed=failed,
        sent_today=sent_today,
        sent_week=sent_week,
        sent_month=sent_month,
        success_rate=round(success_rate, 1),
    )


@router.get("", response_model=SmsListResponse)
async def list_sms(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    sms_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste paginée de l'historique SMS."""
    query = db.query(SmsLog).options(joinedload(SmsLog.intervention))

    if search:
        like = f"%{search}%"
        query = query.outerjoin(Intervention, SmsLog.intervention_id == Intervention.id).filter(
            or_(
                SmsLog.phone.ilike(like),
                SmsLog.message.ilike(like),
                Intervention.client_nom.ilike(like),
                Intervention.client_prenom.ilike(like),
            )
        )

    if status:
        query = query.filter(SmsLog.status == status)

    if sms_type:
        query = query.filter(SmsLog.sms_type == sms_type)

    if date_from:
        try:
            df = datetime.fromisoformat(date_from)
            query = query.filter(SmsLog.sent_at >= df)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.fromisoformat(date_to) + timedelta(days=1)
            query = query.filter(SmsLog.sent_at < dt)
        except ValueError:
            pass

    query = query.order_by(SmsLog.sent_at.desc())

    total = query.count()
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    offset = (page - 1) * page_size

    rows = query.offset(offset).limit(page_size).all()

    items = []
    for row in rows:
        items.append(SmsItem(
            id=str(row.id),
            intervention_id=str(row.intervention_id) if row.intervention_id else None,
            phone=row.phone,
            message=row.message,
            sms_type=row.sms_type.value if hasattr(row.sms_type, "value") else str(row.sms_type),
            status=row.status.value if hasattr(row.status, "value") else str(row.status),
            twilio_sid=row.twilio_sid,
            error_message=row.error_message,
            sent_at=row.sent_at,
            delivered_at=row.delivered_at,
            client_nom=row.intervention.client_nom if row.intervention else None,
            client_prenom=row.intervention.client_prenom if row.intervention else None,
        ))

    return SmsListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
