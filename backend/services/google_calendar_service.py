"""Service Google Calendar : list events depuis l'API.

Utilise google-api-python-client pour interroger Calendar via le token OAuth.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from loguru import logger
from sqlalchemy.orm import Session
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from config import settings
from models.google_credentials import GoogleCredentials
from services import google_oauth_service


def _build_credentials(creds_db: GoogleCredentials, db: Session) -> Credentials:
    """Construit un objet Credentials google-api a partir des creds DB.

    Side effect : refresh le token si expire.
    """
    # S'assure que le token est valide (refresh si necessaire)
    access_token = google_oauth_service.get_valid_access_token(db, creds_db)

    return Credentials(
        token=access_token,
        refresh_token=creds_db.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=creds_db.scopes.split() if creds_db.scopes else None,
    )


def list_calendar_events(
    db: Session,
    creds_db: GoogleCredentials,
    days_ahead: int = 30,
    days_behind: int = 60,
) -> List[Dict[str, Any]]:
    """Liste les events du calendrier sur la periode demandee.

    Args:
        creds_db: GoogleCredentials du user
        days_ahead: Nombre de jours dans le futur (defaut 30)
        days_behind: Nombre de jours dans le passe (defaut 1, pour rattraper)

    Returns:
        Liste de dicts events Google (raw) avec id, summary, description, start, end...
    """
    creds = _build_credentials(creds_db, db)
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    time_min = (datetime.utcnow() - timedelta(days=days_behind)).isoformat() + "Z"
    time_max = (datetime.utcnow() + timedelta(days=days_ahead)).isoformat() + "Z"

    logger.info(f"[GCAL] List events {creds_db.calendar_id} de {time_min[:10]} a {time_max[:10]}")

    events_result = service.events().list(
        calendarId=creds_db.calendar_id or "primary",
        timeMin=time_min,
        timeMax=time_max,
        maxResults=2500,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = events_result.get("items", [])
    logger.info(f"[GCAL] {len(events)} events recuperes")
    return events


def get_calendar_info(db: Session, creds_db: GoogleCredentials) -> Dict[str, Any]:
    """Recupere infos sur le calendrier connecte (nom, timezone, etc.)."""
    creds = _build_credentials(creds_db, db)
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    cal = service.calendars().get(calendarId=creds_db.calendar_id or "primary").execute()
    return {
        "id": cal.get("id"),
        "summary": cal.get("summary"),
        "timezone": cal.get("timeZone"),
    }


def test_connection(db: Session, creds_db: GoogleCredentials) -> Dict[str, Any]:
    """Teste la connexion Calendar et retourne un statut.

    Returns:
        {"success": bool, "email": str, "error": str|None}
    """
    try:
        info = get_calendar_info(db, creds_db)
        return {
            "success": True,
            "email": creds_db.google_email,
            "calendar_summary": info.get("summary"),
            "timezone": info.get("timezone"),
        }
    except Exception as e:
        logger.error(f"[GCAL] Test connection echec : {e}")
        return {"success": False, "email": creds_db.google_email, "error": str(e)}
