"""Routes pour la synchronisation Google Calendar (vraie implementation)."""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from loguru import logger

from database import get_db
from models import User, Intervention
from models.google_credentials import GoogleCredentials
from utils.dependencies import get_current_user
from services import google_oauth_service, google_calendar_service, calendar_sync_service


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


class TestConnectionResponse(BaseModel):
    success: bool
    email: Optional[str] = None
    calendar_summary: Optional[str] = None
    error: Optional[str] = None


class SyncResponse(BaseModel):
    success: bool
    users_synced: int
    total_added: int
    total_updated: int
    total_errors: int


@router.get("/status", response_model=CalendarStatus)
async def get_calendar_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Etat actuel de la sync Google Calendar."""
    creds = google_oauth_service.get_active_credentials(db)

    if not creds:
        return CalendarStatus(
            enabled=False,
            state="disconnected",
            poll_interval_minutes=15,
        )

    return CalendarStatus(
        enabled=True,
        state="connected",
        calendar_email=creds.google_email,
        poll_interval_minutes=15,
        last_sync=creds.last_sync_at.isoformat() if creds.last_sync_at else None,
    )


@router.get("/stats", response_model=CalendarStats)
async def get_calendar_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stats sur les interventions importees depuis Google Calendar."""
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
    """Liste des champs Google Calendar qu'on extrait."""
    return [
        FieldMapping(google_field="summary", intervention_field="client_nom + client_prenom", transformation="Split by space", required=True),
        FieldMapping(google_field="description: TEL ASSU", intervention_field="client_telephone", transformation="Normalisation E.164 (+33...)", required=True),
        FieldMapping(google_field="description: EMAIL ASSU", intervention_field="client_email", required=False),
        FieldMapping(google_field="description: ADRESSE", intervention_field="client_adresse + code_postal + ville", transformation="Split par virgule + regex CP", required=False),
        FieldMapping(google_field="description: TRAVAUX", intervention_field="description_travaux", required=False),
        FieldMapping(google_field="description: MONTANT_TTC", intervention_field="montant_devis_ttc", transformation="Euros vers centimes", required=False),
        FieldMapping(google_field="description: LOGEMENT_2_ANS", intervention_field="logement_plus_2_ans", transformation="Y/N (default Y)", required=False),
        FieldMapping(google_field="start.dateTime", intervention_field="date_rdv", required=True),
        FieldMapping(google_field="end.dateTime - start.dateTime", intervention_field="duree_estimee", transformation="Diff en minutes", required=False),
    ]


@router.get("/history", response_model=List[SyncHistoryEntry])
async def get_sync_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Historique des syncs (basique : juste last_sync pour l'instant)."""
    creds = google_oauth_service.get_active_credentials(db)
    if not creds or not creds.last_sync_at:
        return []
    return [SyncHistoryEntry(
        timestamp=creds.last_sync_at.isoformat(),
        status="success",
    )]


@router.post("/test", response_model=TestConnectionResponse)
async def test_calendar_connection(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Teste la connexion Calendar (recupere infos de l'agenda)."""
    creds = google_oauth_service.get_active_credentials(db)
    if not creds:
        raise HTTPException(status_code=400, detail="Google Calendar non connecte")
    result = google_calendar_service.test_connection(db, creds)
    return TestConnectionResponse(**result)


@router.post("/sync", response_model=SyncResponse)
async def trigger_sync(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Declenche une sync manuelle Calendar -> Interventions."""
    result = calendar_sync_service.sync_all_active(db)
    return SyncResponse(success=True, **result)
