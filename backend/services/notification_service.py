"""Service de notifications pour le dashboard admin.

Centralise la creation des notifications et l'envoi d'email aux admins
pour les evenements critiques.

Workflow :
1. Code metier appelle notify_xxx() apres un evenement
2. notify_xxx() cree une Notification en DB
3. Si severity = critical, envoi automatique d'un mail aux admins
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from loguru import logger
from sqlalchemy.orm import Session

from database import SessionLocal
from models.notification import Notification, NotificationType, NotificationSeverity
from models.intervention import Intervention
from models.setting import Setting


def get_admin_emails(db: Session) -> List[str]:
    """Recupere la liste des emails admin depuis settings."""
    setting = db.query(Setting).filter(Setting.key == "notif.admin_emails").first()
    if not setting or not setting.value:
        return []
    return [e.strip() for e in setting.value.split(",") if e.strip() and "@" in e]


def _send_admin_email(notif: Notification, admin_emails: List[str]) -> bool:
    """Envoie un mail HTML aux admins pour une notification critique.

    Returns True si OK, False sinon.
    """
    if not admin_emails:
        logger.warning("[NOTIF] Aucun admin email configure, skip mail")
        return False

    try:
        from services import email_service
        if not email_service.is_configured():
            logger.warning("[NOTIF] SMTP non configure, skip mail admin")
            return False

        # Construire le mail
        import smtplib
        from email.message import EmailMessage
        from email.utils import formataddr
        from config import settings

        severity_color = {
            "critical": "#dc2626",  # rouge
            "warning": "#f59e0b",   # orange
            "success": "#10b981",   # vert
            "info": "#0073e6",      # bleu
        }.get(notif.severity, "#0073e6")

        link_html = ""
        if notif.link_url:
            link_html = f'<p style="margin-top:20px;"><a href="{settings.APP_URL}{notif.link_url}" style="display:inline-block;padding:10px 20px;background:{severity_color};color:white;text-decoration:none;border-radius:6px;font-weight:600;">Voir dans le dashboard</a></p>'

        html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:0;color:#1f2937;">
  <div style="background:{severity_color};color:white;padding:20px 28px;">
    <h1 style="margin:0;font-size:18px;">[Les Bons Plombiers] Notification {notif.severity}</h1>
  </div>
  <div style="padding:28px;background:#fff;">
    <h2 style="margin:0 0 12px 0;font-size:18px;color:#111;">{notif.title}</h2>
    <p style="line-height:1.6;color:#374151;">{notif.message}</p>
    {link_html}
    <p style="font-size:12px;color:#9ca3af;margin-top:30px;border-top:1px solid #e5e7eb;padding-top:14px;">
      Notification generee le {notif.created_at.strftime('%d/%m/%Y a %H:%M')}<br>
      Pour ne plus recevoir ces emails, modifiez les preferences dans le dashboard.
    </p>
  </div>
</body></html>"""

        msg = EmailMessage()
        msg["From"] = formataddr((settings.SMTP_FROM_NAME or "LBP Admin", settings.SMTP_FROM_EMAIL or settings.SMTP_USER))
        msg["To"] = ", ".join(admin_emails)
        msg["Subject"] = f"[LBP {notif.severity.upper()}] {notif.title}"
        msg.set_content(f"{notif.title}\n\n{notif.message}")
        msg.add_alternative(html, subtype="html")

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)

        logger.info(f"[NOTIF] Mail admin envoye a {admin_emails}")
        return True

    except Exception as e:
        logger.error(f"[NOTIF] Echec mail admin : {e}")
        return False


def create_notification(
    db: Session,
    type_: str,
    severity: str,
    title: str,
    message: str,
    link_url: Optional[str] = None,
    intervention_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    send_email: Optional[bool] = None,
) -> Notification:
    """Cree une notification et envoie le mail admin si severity=critical.

    Args:
        db: Session DB
        type_: NotificationType.value (ex: "sms_failed")
        severity: "info" / "success" / "warning" / "critical"
        title: Titre court (255 chars max)
        message: Description detaillee
        link_url: URL relative pour cliquer (ex: "/dashboard/interventions/abc")
        intervention_id: UUID intervention liee
        metadata: Dict libre stocke en JSONB
        send_email: Force l'envoi mail (None = auto selon severity)

    Returns:
        Notification cree
    """
    notif = Notification(
        type=type_,
        severity=severity,
        title=title[:255],
        message=message,
        link_url=link_url,
        intervention_id=intervention_id,
        metadata_json=metadata,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Envoi mail admin auto pour critical (sauf si send_email=False)
    should_email = send_email if send_email is not None else (severity == "critical")
    if should_email:
        admin_emails = get_admin_emails(db)
        if admin_emails:
            if _send_admin_email(notif, admin_emails):
                notif.email_sent = True
                notif.email_sent_at = datetime.utcnow()
                db.commit()

    logger.info(f"[NOTIF] {severity.upper()} {type_} : {title}")
    return notif


# ============================================================
# HELPERS METIER
# ============================================================

def notify_signature_complete(db: Session, intervention: Intervention) -> Notification:
    """Notif quand TOUS les docs sont signes."""
    name = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip() or "Client"
    return create_notification(
        db,
        type_=NotificationType.SIGNATURE_COMPLETE.value,
        severity=NotificationSeverity.SUCCESS.value,
        title=f"Documents signes : {name}",
        message=f"L'intervention de {name} a ete entierement signee. Tous les documents sont valides juridiquement.",
        link_url=f"/dashboard/interventions/{intervention.id}",
        intervention_id=intervention.id,
    )


def notify_sms_failed(db: Session, intervention: Intervention, error: str = "") -> Notification:
    """Notif SMS qui a echoue (severity warning, pas critical)."""
    name = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip() or "Client"
    return create_notification(
        db,
        type_=NotificationType.SMS_FAILED.value,
        severity=NotificationSeverity.WARNING.value,
        title=f"SMS echoue : {name}",
        message=f"L'envoi du SMS a {name} ({intervention.client_telephone}) a echoue. {error}",
        link_url=f"/dashboard/interventions/{intervention.id}",
        intervention_id=intervention.id,
        metadata={"error": error[:200]} if error else None,
    )


def notify_email_sent(db: Session, recipient: str, intervention: Intervention) -> Notification:
    """Notif quand le mail PDF signe a ete envoye au client."""
    name = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip() or "Client"
    return create_notification(
        db,
        type_=NotificationType.EMAIL_SENT.value,
        severity=NotificationSeverity.INFO.value,
        title=f"PDF envoye par email a {name}",
        message=f"Les documents signes ont ete envoyes a {recipient}.",
        link_url=f"/dashboard/interventions/{intervention.id}",
        intervention_id=intervention.id,
    )


def notify_email_failed(db: Session, recipient: str, intervention: Optional[Intervention], error: str = "") -> Notification:
    """Notif si echec d'envoi email."""
    return create_notification(
        db,
        type_=NotificationType.EMAIL_FAILED.value,
        severity=NotificationSeverity.WARNING.value,
        title=f"Email echoue : {recipient}",
        message=f"L'envoi du PDF signe a {recipient} a echoue. {error}",
        link_url=f"/dashboard/interventions/{intervention.id}" if intervention else None,
        intervention_id=intervention.id if intervention else None,
        metadata={"error": error[:200], "recipient": recipient} if error else {"recipient": recipient},
    )


def notify_calendar_sync_success(db: Session, count_added: int, count_updated: int) -> Optional[Notification]:
    """Notif sync Calendar reussie (uniquement si ajouts ou updates)."""
    if count_added == 0 and count_updated == 0:
        return None  # Pas de notif si rien n'a change
    return create_notification(
        db,
        type_=NotificationType.CALENDAR_SYNC_SUCCESS.value,
        severity=NotificationSeverity.INFO.value,
        title=f"Sync Calendar : {count_added} ajout(s), {count_updated} update(s)",
        message=f"La synchronisation Google Calendar a ajoute {count_added} interventions et mis a jour {count_updated}.",
        link_url="/dashboard/interventions",
        metadata={"added": count_added, "updated": count_updated},
    )


def notify_calendar_sync_error(db: Session, error: str) -> Notification:
    """Notif sync Calendar foiree (CRITICAL → mail admin)."""
    return create_notification(
        db,
        type_=NotificationType.CALENDAR_SYNC_ERROR.value,
        severity=NotificationSeverity.CRITICAL.value,
        title="Erreur sync Google Calendar",
        message=f"La synchronisation a echoue : {error[:300]}. Verifier la connexion Google.",
        link_url="/dashboard/calendrier",
        metadata={"error": error[:500]},
    )


def notify_intervention_created(db: Session, intervention: Intervention, source: str = "manual") -> Notification:
    """Notif nouvelle intervention creee (depuis Calendar ou manuellement)."""
    name = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip() or "Client"
    src_label = "depuis Google Calendar" if source == "calendar" else "manuellement"
    return create_notification(
        db,
        type_=NotificationType.INTERVENTION_CREATED.value,
        severity=NotificationSeverity.INFO.value,
        title=f"Nouvelle intervention : {name}",
        message=f"L'intervention de {name} a ete creee {src_label}.",
        link_url=f"/dashboard/interventions/{intervention.id}",
        intervention_id=intervention.id,
        metadata={"source": source},
    )


def notify_intervention_expired(db: Session, intervention: Intervention) -> Notification:
    """Notif lien signature expire sans avoir ete signe."""
    name = f"{intervention.client_prenom or ''} {intervention.client_nom or ''}".strip() or "Client"
    return create_notification(
        db,
        type_=NotificationType.INTERVENTION_EXPIRED.value,
        severity=NotificationSeverity.WARNING.value,
        title=f"Lien signature expire : {name}",
        message=f"Le lien de signature pour {name} a expire sans avoir ete signe. Pensez a relancer.",
        link_url=f"/dashboard/interventions/{intervention.id}",
        intervention_id=intervention.id,
    )


def notify_system_error(db: Session, title: str, error: str) -> Notification:
    """Notif erreur systeme generique (CRITICAL → mail admin)."""
    return create_notification(
        db,
        type_=NotificationType.SYSTEM_ERROR.value,
        severity=NotificationSeverity.CRITICAL.value,
        title=title[:255],
        message=f"Erreur systeme : {error[:500]}",
        metadata={"error": error[:1000]},
    )


# ============================================================
# QUERIES (pour les routes)
# ============================================================

def list_notifications(
    db: Session,
    limit: int = 20,
    offset: int = 0,
    only_unread: bool = False,
    type_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
):
    """Liste paginee des notifications."""
    q = db.query(Notification)
    if only_unread:
        q = q.filter(Notification.is_read == False)
    if type_filter:
        q = q.filter(Notification.type == type_filter)
    if severity_filter:
        q = q.filter(Notification.severity == severity_filter)
    return q.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()


def count_unread(db: Session) -> int:
    """Compte les notifs non lues."""
    return db.query(Notification).filter(Notification.is_read == False).count()


def mark_as_read(db: Session, notif_id: str) -> Optional[Notification]:
    """Marque une notif comme lue."""
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if notif and not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.utcnow()
        db.commit()
    return notif


def mark_all_as_read(db: Session) -> int:
    """Marque toutes les notifs comme lues. Retourne le count."""
    count = db.query(Notification).filter(Notification.is_read == False).update({
        "is_read": True,
        "read_at": datetime.utcnow(),
    })
    db.commit()
    return count
