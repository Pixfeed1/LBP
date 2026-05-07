"""Service de synchronisation : Google Calendar -> Interventions.

Pour chaque event matche (avec TEL ASSU dans description), on cree une
Intervention si pas deja existante (matching par google_event_id).
Si existante, on la met a jour.
"""
from datetime import datetime
from typing import Dict, Any, Tuple
from loguru import logger
from sqlalchemy.orm import Session

from models.intervention import Intervention, InterventionStatus
from models.google_credentials import GoogleCredentials
from services import google_calendar_service, calendar_event_parser


def sync_for_credentials(db: Session, creds_db: GoogleCredentials) -> Dict[str, int]:
    """Sync les events du calendrier d'un utilisateur vers les interventions.

    Returns:
        Dict avec stats : {"events_total", "events_parsed", "added", "updated", "errors"}
    """
    stats = {
        "events_total": 0,
        "events_parsed": 0,
        "added": 0,
        "updated": 0,
        "errors": 0,
    }

    try:
        events = google_calendar_service.list_calendar_events(db, creds_db)
        stats["events_total"] = len(events)

        for event in events:
            try:
                parsed = calendar_event_parser.parse_event(event)
                if not parsed:
                    continue
                stats["events_parsed"] += 1

                # Cherche si l'intervention existe deja (par google_event_id)
                existing = db.query(Intervention).filter(
                    Intervention.google_event_id == parsed["google_event_id"]
                ).first()

                if existing:
                    # Update des champs (sauf si deja signe)
                    if existing.status != InterventionStatus.SIGNED:
                        for field, value in parsed.items():
                            if field == "google_event_id":
                                continue
                            setattr(existing, field, value)
                        stats["updated"] += 1
                else:
                    # Cree nouvelle intervention
                    intv = Intervention(
                        **parsed,
                        status=InterventionStatus.DRAFT,
                    )
                    db.add(intv)
                    stats["added"] += 1

            except Exception as e:
                logger.error(f"[SYNC] Erreur sur event {event.get('id')} : {e}")
                stats["errors"] += 1
                continue

        db.commit()

        # Update last_sync_at
        creds_db.last_sync_at = datetime.utcnow()
        db.commit()

        logger.info(
            f"[SYNC] Termine pour {creds_db.google_email} : "
            f"{stats['added']} ajoutees, {stats['updated']} mises a jour, "
            f"{stats['errors']} erreurs / {stats['events_total']} events totaux"
        )
        return stats

    except Exception as e:
        logger.exception(f"[SYNC] Erreur globale pour {creds_db.google_email} : {e}")
        stats["errors"] += 1
        return stats


def sync_all_active(db: Session) -> Dict[str, Any]:
    """Sync tous les utilisateurs actifs (utilise par le scheduler).

    Returns:
        Dict avec stats globales {"users_synced", "total_added", "total_updated", "total_errors"}
    """
    active_creds = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True).all()

    if not active_creds:
        logger.info("[SYNC] Aucun utilisateur actif Google Calendar")
        return {"users_synced": 0, "total_added": 0, "total_updated": 0, "total_errors": 0}

    total_added = 0
    total_updated = 0
    total_errors = 0
    users_synced = 0

    for creds in active_creds:
        result = sync_for_credentials(db, creds)
        total_added += result["added"]
        total_updated += result["updated"]
        total_errors += result["errors"]
        users_synced += 1

    return {
        "users_synced": users_synced,
        "total_added": total_added,
        "total_updated": total_updated,
        "total_errors": total_errors,
    }
