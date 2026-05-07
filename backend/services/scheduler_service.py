"""
Scheduler pour les relances automatiques.

Deux jobs :
1. Rappel J-1 : tous les jours à H configurable, envoie SMS rappel
   pour les RDV du lendemain qui ne sont pas encore entièrement signés.
2. Relance signature : toutes les heures, vérifie les signatures envoyées
   il y a > X heures et non signées, envoie un SMS de relance.

Le scheduler démarre via FastAPI lifespan dans main.py.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from loguru import logger
from typing import Optional

from database import SessionLocal
from models.intervention import Intervention
# (pas d'import Signature : on raisonne sur Intervention + Document directement)
from models.sms_log import SmsLog, SmsType, SmsStatus
from services.sms_service import send_sms_twilio
from models.setting import Setting


def _fetch_setting(key: str) -> Optional[str]:
    """Récupère la valeur d'un setting via une session DB temporaire."""
    db = SessionLocal()
    try:
        s = db.query(Setting).filter(Setting.key == key).first()
        return s.value if s else None
    finally:
        db.close()


def _get_int_setting(key: str, default: int) -> int:
    """Récupère un setting numérique avec fallback."""
    val = _fetch_setting(key)
    if not val:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _is_enabled(key: str) -> bool:
    """Récupère un setting boolean (Y/N ou true/false)."""
    val = _fetch_setting(key)
    if not val:
        return False
    return str(val).lower() in ("y", "true", "1", "yes")


def _build_signature_url(token: str) -> str:
    """Construit l'URL publique de signature."""
    import os
    base = os.getenv("PUBLIC_FRONTEND_URL", "https://lesbonsplombiers.pixfeed.net")
    return f"{base}/signature/{token}"


def _format_template(template: str, intervention: Intervention, signature_token: Optional[str] = None, **extra) -> str:
    """Substitue les variables {prenom} {nom} {date} {heure} {url} {nb_docs} dans le template."""
    date_str = intervention.date_rdv.strftime("%d/%m/%Y") if intervention.date_rdv else ""
    heure_str = intervention.date_rdv.strftime("%Hh%M") if intervention.date_rdv else ""
    url_str = _build_signature_url(signature_token) if signature_token else ""

    result = template
    replacements = {
        "{prenom}": intervention.client_prenom or "",
        "{nom}": intervention.client_nom or "",
        "{date}": date_str,
        "{heure}": heure_str,
        "{url}": url_str,
        "{nb_docs}": str(extra.get("nb_docs", 1)),
    }
    for k, v in replacements.items():
        result = result.replace(k, v)
    return result


# ============================================================
# JOB 1 : Rappel J-1 (rappel pour RDV de demain)
# ============================================================

def job_rappel_j1():
    """
    Tourne 1x/jour à H heure FR.
    Envoie un SMS de rappel aux clients qui ont un RDV demain et qui n'ont pas
    encore signé tous leurs documents.
    """
    logger.info("[SCHEDULER] Démarrage job_rappel_j1")

    if not _is_enabled("relance.rappel_j1_enabled"):
        logger.info("[SCHEDULER] rappel_j1 désactivé")
        return

    db = SessionLocal()
    try:
        # Demain entre 00h et 23h59
        tomorrow_start = (datetime.utcnow() + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_end = tomorrow_start + timedelta(days=1)

        interventions = db.query(Intervention).filter(
            and_(
                Intervention.date_rdv >= tomorrow_start,
                Intervention.date_rdv < tomorrow_end,
                
            )
        ).all()

        logger.info(f"[SCHEDULER] {len(interventions)} interventions trouvees pour demain")

        template = _fetch_setting("sms.template_rappel_j1") or \
            "Rappel : intervention LBP demain {date} a {heure} chez vous."

        sent_count = 0
        for intv in interventions:
            # On ne renvoie pas si on a déjà envoyé un rappel J-1 récent
            if intv.last_reminder_at and (datetime.utcnow() - intv.last_reminder_at).total_seconds() < 12 * 3600:
                logger.info(f"[SCHEDULER] Skip {intv.id} : rappel deja envoye recemment")
                continue

            if not intv.client_telephone:
                continue

            # Construit le message via template
            msg = _format_template(template, intv)

            try:
                result = send_sms_twilio(
                    to_number=intv.client_telephone,
                    message=msg,
                    intervention_id=str(intv.id),
                    sms_type=SmsType.RDV_RAPPEL,
                    db=db,
                )
                intv.last_reminder_at = datetime.utcnow()
                intv.reminder_count = (intv.reminder_count or 0) + 1
                db.commit()
                sent_count += 1
                logger.info(f"[SCHEDULER] Rappel J-1 envoye a {intv.client_telephone} (intv {intv.id})")
            except Exception as e:
                logger.error(f"[SCHEDULER] Erreur envoi rappel pour {intv.id} : {e}")

        logger.info(f"[SCHEDULER] job_rappel_j1 termine : {sent_count}/{len(interventions)} SMS envoyes")
    finally:
        db.close()


# ============================================================
# JOB 2 : Relance signature (signatures non signees apres X heures)
# ============================================================

def job_relance_signatures():
    """
    Tourne toutes les heures.
    Trouve les interventions ayant au moins 1 document non signe ET un envoi initial
    via SMS il y a plus de X heures. Envoie un SMS de relance (max N fois).
    """
    logger.info("[SCHEDULER] Démarrage job_relance_signatures")

    if not _is_enabled("relance.signature_enabled"):
        logger.info("[SCHEDULER] relance signatures désactivée")
        return

    db = SessionLocal()
    try:
        from models.document import Document, DocumentStatus

        delay_hours = _get_int_setting("relance.signature_delay_hours", 24)
        max_count = _get_int_setting("relance.signature_max_count", 2)
        threshold = datetime.utcnow() - timedelta(hours=delay_hours)

        # Interventions actives avec un envoi initial SMS il y a > delay_hours
        interventions = db.query(Intervention).filter(
            and_(
                
                Intervention.last_sms_sent_at.isnot(None),
                Intervention.last_sms_sent_at < threshold,
            )
        ).all()

        logger.info(f"[SCHEDULER] {len(interventions)} interventions candidates (envoi initial > {delay_hours}h)")

        sent_count = 0
        for intv in interventions:
            # Tous les docs signes ?
            unsigned_count = db.query(Document).filter(
                Document.intervention_id == intv.id,
                Document.status != DocumentStatus.SIGNED,
            ).count()
            if unsigned_count == 0:
                continue

            # Max relances atteint ?
            current_count = intv.reminder_count or 0
            if current_count >= max_count:
                continue

            # Derniere relance trop recente ?
            if intv.last_reminder_at and (datetime.utcnow() - intv.last_reminder_at).total_seconds() < delay_hours * 3600:
                continue

            if not intv.client_telephone:
                continue

            # Recupere le token de signature actif (le plus recent envoi)
            # On cherche dans sms_logs le dernier SIGNATURE_INITIAL pour reconstruire l'URL
            from models.sms_log import SmsLog
            last_initial_sms = db.query(SmsLog).filter(
                SmsLog.intervention_id == intv.id,
                SmsLog.sms_type == SmsType.SIGNATURE_INITIAL,
            ).order_by(SmsLog.sent_at.desc()).first()

            # Extrait le token de l'URL dans le message
            token = None
            if last_initial_sms and last_initial_sms.message:
                import re as _re
                m = _re.search(r'/signature/([A-Za-z0-9_\-]+)', last_initial_sms.message)
                if m:
                    token = m.group(1)

            if not token:
                logger.warning(f"[SCHEDULER] Skip {intv.id} : pas de token de signature retrouvable")
                continue

            template = _fetch_setting("sms.template_signature_relance") or _fetch_setting("sms.template_relance") or \
                "Bonjour {prenom}, n'oubliez pas de signer vos documents : {url}"
            msg = _format_template(template, intv, signature_token=token, nb_docs=unsigned_count)

            try:
                send_sms_twilio(
                    to_number=intv.client_telephone,
                    message=msg,
                    intervention_id=str(intv.id),
                    sms_type=SmsType.SIGNATURE_RELANCE,
                    db=db,
                )
                intv.last_reminder_at = datetime.utcnow()
                intv.reminder_count = current_count + 1
                db.commit()
                sent_count += 1
                logger.info(f"[SCHEDULER] Relance signature envoyee a {intv.client_telephone} (intv {intv.id}, count={current_count + 1}/{max_count})")
            except Exception as e:
                logger.error(f"[SCHEDULER] Erreur relance pour {intv.id} : {e}")

        logger.info(f"[SCHEDULER] job_relance_signatures termine : {sent_count} SMS envoyes")
    finally:
        db.close()


# ============================================================
# Configuration et démarrage du scheduler
# ============================================================

_scheduler = None




def job_sync_calendar():
    """Sync les events Google Calendar -> Interventions toutes les 15 min."""
    if not _is_enabled("relance.scheduler_enabled"):
        return
    try:
        from services import calendar_sync_service
        db = SessionLocal()
        try:
            stats = calendar_sync_service.sync_all_active(db)
            if stats.get("users_synced", 0) > 0:
                logger.info(
                    f"[SCHEDULER] Sync Calendar : {stats['total_added']} ajoutees, "
                    f"{stats['total_updated']} mises a jour ({stats['users_synced']} users)"
                )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[SCHEDULER] Sync Calendar erreur : {e}")


def start_scheduler():
    """Démarre le scheduler APScheduler avec les 2 jobs."""
    global _scheduler

    if not _is_enabled("relance.scheduler_enabled"):
        logger.info("[SCHEDULER] Scheduler globalement désactivé via relance.scheduler_enabled")
        return None

    if _scheduler is not None:
        logger.warning("[SCHEDULER] Déjà démarré, skip")
        return _scheduler

    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.triggers.interval import IntervalTrigger
    import pytz

    paris_tz = pytz.timezone("Europe/Paris")

    _scheduler = BackgroundScheduler(timezone=paris_tz)

    # Job 1 : Rappel J-1 (1x/jour à H heure)
    rappel_hour = _get_int_setting("relance.rappel_j1_hour", 18)
    _scheduler.add_job(
        job_rappel_j1,
        trigger=CronTrigger(hour=rappel_hour, minute=0, timezone=paris_tz),
        id="rappel_j1",
        replace_existing=True,
    )
    logger.info(f"[SCHEDULER] Job 'rappel_j1' programme tous les jours a {rappel_hour}h")

    # Job 2 : Relance signature (toutes les heures)
    _scheduler.add_job(
        job_relance_signatures,
        trigger=IntervalTrigger(hours=1),
        id="relance_signatures",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Job 'relance_signatures' programme toutes les heures")

    _scheduler.start()
    logger.info("[SCHEDULER] APScheduler demarre avec 2 jobs")
    return _scheduler


def stop_scheduler():
    """Arrête le scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("[SCHEDULER] APScheduler arrete")


def get_scheduler_status() -> dict:
    """Retourne le status du scheduler pour l'API."""
    if not _scheduler:
        return {"running": False, "jobs": []}

    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": str(job.next_run_time) if job.next_run_time else None,
            "trigger": str(job.trigger),
        })

    return {
        "running": _scheduler.running,
        "jobs": jobs,
    }


def trigger_job_now(job_id: str) -> bool:
    """Déclenche un job manuellement (debug/test)."""
    if job_id == "rappel_j1":
        job_rappel_j1()
    elif job_id == "sync_calendar":
        job_sync_calendar()
        return True
    elif job_id == "relance_signatures":
        job_relance_signatures()
        return True
    return False
