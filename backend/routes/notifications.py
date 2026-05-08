"""Routes pour les notifications systeme du dashboard admin."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User
from utils.dependencies import get_current_user
from services import notification_service


router = APIRouter()


# ============================================================
# SCHEMAS
# ============================================================

class NotificationOut(BaseModel):
    id: str
    type: str
    severity: str
    title: str
    message: str
    link_url: Optional[str] = None
    intervention_id: Optional[str] = None
    is_read: bool
    read_at: Optional[str] = None
    email_sent: bool
    metadata: Optional[dict] = None
    created_at: str

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    items: List[NotificationOut]
    total: int
    unread_count: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    unread_count: int


class MarkReadResponse(BaseModel):
    success: bool
    notification_id: Optional[str] = None


class MarkAllReadResponse(BaseModel):
    success: bool
    marked_count: int


# ============================================================
# HELPERS
# ============================================================

def _serialize_notif(notif) -> NotificationOut:
    """Convertit une Notification SQLAlchemy en NotificationOut."""
    return NotificationOut(
        id=str(notif.id),
        type=notif.type,
        severity=notif.severity,
        title=notif.title,
        message=notif.message,
        link_url=notif.link_url,
        intervention_id=str(notif.intervention_id) if notif.intervention_id else None,
        is_read=notif.is_read,
        read_at=notif.read_at.isoformat() if notif.read_at else None,
        email_sent=notif.email_sent,
        metadata=notif.metadata_json,
        created_at=notif.created_at.isoformat(),
    )


# ============================================================
# ROUTES
# ============================================================

@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    only_unread: bool = Query(False),
    type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Liste paginee des notifications avec filtres."""
    offset = (page - 1) * page_size

    items = notification_service.list_notifications(
        db,
        limit=page_size,
        offset=offset,
        only_unread=only_unread,
        type_filter=type,
        severity_filter=severity,
    )

    # Total filtree (pour pagination)
    from models.notification import Notification
    q = db.query(Notification)
    if only_unread:
        q = q.filter(Notification.is_read == False)
    if type:
        q = q.filter(Notification.type == type)
    if severity:
        q = q.filter(Notification.severity == severity)
    total = q.count()

    unread = notification_service.count_unread(db)

    return NotificationListResponse(
        items=[_serialize_notif(n) for n in items],
        total=total,
        unread_count=unread,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Compte des notifications non lues (pour badge cloche)."""
    count = notification_service.count_unread(db)
    return UnreadCountResponse(unread_count=count)


@router.post("/{notif_id}/read", response_model=MarkReadResponse)
async def mark_notification_read(
    notif_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marque une notification comme lue."""
    notif = notification_service.mark_as_read(db, notif_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    return MarkReadResponse(success=True, notification_id=str(notif.id))


@router.post("/mark-all-read", response_model=MarkAllReadResponse)
async def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Marque toutes les notifications comme lues."""
    count = notification_service.mark_all_as_read(db)
    return MarkAllReadResponse(success=True, marked_count=count)
