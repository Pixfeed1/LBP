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
        new_interventions = []  # collecte pour auto-envoi APRES la boucle (garde-fous)

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
                        status=InterventionStatus.PENDING,
                    )
                    db.add(intv)
                    db.flush()  # Pour avoir l'ID avant commit final
                    stats["added"] += 1
                    # Notif intervention creee depuis Calendar
                    try:
                        from services import notification_service as _nsvc
                        _nsvc.notify_intervention_created(db, intv, source="calendar")
                    except Exception as ne:
                        logger.warning(f"[SYNC] Notif intervention_created echec : {ne}")
                    # Collecte pour auto-envoi APRES la boucle (garde-fous rafale + RDV passe)
                    new_interventions.append(intv)

            except Exception as e:
                logger.error(f"[SYNC] Erreur sur event {event.get('id')} : {e}")
                stats["errors"] += 1
                continue

        db.commit()

        # === Auto-envoi avec garde-fous : skip RDV passes + anti-rafale ===
        stats["auto_sent"] = 0
        stats["auto_skipped_past"] = 0
        stats["auto_suspended"] = 0
        if new_interventions:
            try:
                from models.setting import Setting as _Setting
                _s = db.query(_Setting).filter(_Setting.key == "calendar.auto_send_sms").first()
                auto_on = bool(_s and str(_s.value).lower() in ("y", "true", "1", "yes"))
            except Exception as _se:
                logger.warning(f"[SYNC] Lecture setting auto_send_sms echec : {_se}")
                auto_on = False

            if auto_on:
                now = datetime.utcnow()
                # Garde-fou 1 : ne jamais auto-envoyer pour un RDV deja passe
                eligibles = [i for i in new_interventions if i.date_rdv and i.date_rdv >= now]
                stats["auto_skipped_past"] = len(new_interventions) - len(eligibles)
                if stats["auto_skipped_past"]:
                    logger.info(f"[SYNC] {stats['auto_skipped_past']} RDV passes ignores (pas de SMS)")
                # === FILTRE METIER (18/06/2026) : envoi auto uniquement si dossier assurance ===
                _before_metier = len(eligibles)
                eligibles = [
                    i for i in eligibles
                    if (i.numero_contrat and i.numero_contrat.strip())
                       or (i.numero_sinistre and i.numero_sinistre.strip())
                       or (i.reference_ma and i.reference_ma.strip())
                ]
                stats["auto_skipped_no_ref"] = _before_metier - len(eligibles)
                if stats["auto_skipped_no_ref"]:
                    logger.info(f"[SYNC] {stats['auto_skipped_no_ref']} RDV sans REFMA/contrat/sinistre ignores (pas de SMS)")

                # Garde-fou 2 : anti-rafale (ex. apres une longue deconnexion)
                SEUIL_RAFALE = 10
                if len(eligibles) > SEUIL_RAFALE:
                    stats["auto_suspended"] = len(eligibles)
                    logger.warning(
                        f"[SYNC] RAFALE detectee ({len(eligibles)} nouveaux RDV a venir > seuil {SEUIL_RAFALE}). "
                        f"Auto-envoi SUSPENDU, validation manuelle requise (bouton Rappels J-1)."
                    )
                    try:
                        from services import notification_service as _nsvc
                        _nsvc.notify_calendar_sync_burst(db, len(eligibles))
                    except Exception as _ne:
                        logger.warning(f"[SYNC] Notif rafale echec : {_ne}")
                else:
                    from services.signature_service import prepare_signature_workflow as _psw
                    for intv in eligibles:
                        try:
                            _wf = _psw(db, intv)
                            stats["auto_sent"] += 1
                            logger.info(
                                f"[SYNC] Auto-envoi signature OK pour intv {intv.id} "
                                f"(sms_sent={_wf.get('sms_sent')}, docs={_wf.get('documents_generated')})"
                            )
                        except Exception as _we:
                            logger.error(f"[SYNC] Auto-envoi signature echec pour intv {intv.id} : {_we}")
                    db.commit()

        # Update last_sync_at
        creds_db.last_sync_at = datetime.utcnow()
        db.commit()

        logger.info(
            f"[SYNC] Termine pour {creds_db.google_email} : "
            f"{stats['added']} ajoutees, {stats['updated']} mises a jour, "
            f"{stats['errors']} erreurs / {stats['events_total']} events totaux"
        )
        # Notif admin si ajouts ou updates
        try:
            from services import notification_service as _nsvc
            _nsvc.notify_calendar_sync_success(db, stats["added"], stats["updated"])
        except Exception as e:
            logger.warning(f"[SYNC] Notif sync_success echec : {e}")
        return stats

    except Exception as e:
        logger.exception(f"[SYNC] Erreur globale pour {creds_db.google_email} : {e}")
        stats["errors"] += 1
        # Notif admin CRITICAL
        try:
            from services import notification_service as _nsvc
            _nsvc.notify_calendar_sync_error(db, str(e))
        except Exception as ne:
            logger.warning(f"[SYNC] Notif sync_error echec : {ne}")
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
