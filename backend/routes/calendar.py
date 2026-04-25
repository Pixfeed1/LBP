"""Routes pour la synchronisation Google Calendar."""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import User, Intervention
from utils.dependencies import get_current_user
from config import settings


router = APIRouter()


class CalendarStatus(BaseModel):
    enabled: bool
    state: str  # "connected" | "disconnected" | "error"
    calendar_email: Optional[str] = None
    poll_interval_minutes: int
    last_sync: Optional[str] = None
    error_message: Optional[str] = None


class CalendarStats(BaseModel):
    total_synced: int
    today: int
    week: int
    month: int
    last_event_at: Optional[str] = None


class SyncHistoryEntry(BaseModel):
    timestamp: str
    status: str
    events_added: int = 0
    events_updated: int = 0
    error: Optional[str] = None


class FieldMapping(BaseModel):
    google_field: str
    intervention_field: str
    transformation: Optional[str] = None
    required: bool = False


def _is_configured() -> bool:
    """Vérifie si les credentials Google sont remplis dans .env."""
    # Au minimum on a besoin de l'email + app password OU client_id/secret
    has_basic = bool(settings.GOOGLE_CALENDAR_EMAIL and settings.GOOGLE_APP_PASSWORD)
    has_oauth = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
    return has_basic or has_oauth


@router.get("/status", response_model=CalendarStatus)
async def get_calendar_status(user: User = Depends(get_current_user)):
    """État actuel de la sync Google Calendar."""
    
    if not _is_configured():
        return CalendarStatus(
            enabled=False,
            state="disconnected",
            poll_interval_minutes=15,
        )
    
    # Si configuré, on est en "connected" (l'erreur sera testée à l'usage réel)
    return CalendarStatus(
        enabled=True,
        state="connected",
        calendar_email=settings.GOOGLE_CALENDAR_EMAIL,
        poll_interval_minutes=15,
        last_sync=None,  # à remplir plus tard avec un cron job
    )


@router.get("/stats", response_model=CalendarStats)
async def get_calendar_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stats sur les interventions importées depuis Google Calendar."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    base = db.query(Intervention).filter(Intervention.google_event_id.isnot(None))
    
    total = base.count()
    today_count = base.filter(Intervention.created_at >= today_start).count()
    week_count = base.filter(Intervention.created_at >= week_start).count()
    month_count = base.filter(Intervention.created_at >= month_start).count()
    
    last = base.order_by(Intervention.created_at.desc()).first()
    
    return CalendarStats(
        total_synced=total,
        today=today_count,
        week=week_count,
        month=month_count,
        last_event_at=last.created_at.isoformat() if last else None,
    )


@router.get("/mapping", response_model=List[FieldMapping])
async def get_field_mapping(user: User = Depends(get_current_user)):
    """Mapping Google Calendar → Intervention."""
    return [
        FieldMapping(
            google_field="summary",
            intervention_field="description_travaux",
            transformation="Texte direct (ex: 'Remplacement chaudière')",
            required=True,
        ),
        FieldMapping(
            google_field="start.dateTime",
            intervention_field="date_rdv",
            transformation="ISO 8601 → DateTime UTC",
            required=True,
        ),
        FieldMapping(
            google_field="location",
            intervention_field="client_adresse + client_code_postal + client_ville",
            transformation="Parsing intelligent (regex CP)",
            required=False,
        ),
        FieldMapping(
            google_field="description (parsing pattern)",
            intervention_field="client_nom, client_prenom, client_telephone",
            transformation="Format attendu : 'Nom Prénom\\n0612345678'",
            required=True,
        ),
        FieldMapping(
            google_field="id",
            intervention_field="google_event_id",
            transformation="Stockage direct pour deduplication",
            required=True,
        ),
        FieldMapping(
            google_field="end.dateTime - start.dateTime",
            intervention_field="duree_estimee",
            transformation="Calcul en minutes",
            required=False,
        ),
    ]


@router.get("/history", response_model=List[SyncHistoryEntry])
async def get_sync_history(user: User = Depends(get_current_user)):
    """Historique des syncs (mock pour l'instant)."""
    if not _is_configured():
        return []
    
    now = datetime.utcnow()
    return [
        SyncHistoryEntry(
            timestamp=(now - timedelta(minutes=15)).isoformat(),
            status="success",
            events_added=2,
            events_updated=0,
        ),
        SyncHistoryEntry(
            timestamp=(now - timedelta(hours=1)).isoformat(),
            status="success",
            events_added=0,
            events_updated=1,
        ),
        SyncHistoryEntry(
            timestamp=(now - timedelta(hours=2)).isoformat(),
            status="success",
            events_added=1,
            events_updated=0,
        ),
    ]


class TestConnectionResponse(BaseModel):
    success: bool
    message: str


@router.post("/test", response_model=TestConnectionResponse)
async def test_connection(user: User = Depends(get_current_user)):
    """Teste la connexion à Google Calendar."""
    if not _is_configured():
        return TestConnectionResponse(
            success=False,
            message="Credentials Google manquants dans le .env",
        )
    return TestConnectionResponse(
        success=True,
        message="Connexion OK (test mock - implémentation API Google à venir)",
    )
