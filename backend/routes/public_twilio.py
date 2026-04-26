"""Routes publiques Twilio (webhooks status callbacks, sans auth)."""
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from twilio.request_validator import RequestValidator
from datetime import datetime
from loguru import logger
import os

from database import get_db
from models.sms_log import SmsLog, SmsStatus

router = APIRouter()


def _map_twilio_status(twilio_status: str) -> SmsStatus:
    """Convertit le status Twilio en SmsStatus enum local."""
    mapping = {
        "queued": SmsStatus.PENDING,
        "accepted": SmsStatus.PENDING,
        "scheduled": SmsStatus.PENDING,
        "sending": SmsStatus.SENT,
        "sent": SmsStatus.SENT,
        "delivered": SmsStatus.DELIVERED,
        "undelivered": SmsStatus.UNDELIVERED,
        "failed": SmsStatus.FAILED,
    }
    return mapping.get(twilio_status.lower(), SmsStatus.SENT)


@router.get("/health")
def public_twilio_health():
    """Healthcheck (test que /api/public/twilio/* est routé au backend)."""
    return {"status": "ok", "scope": "public_twilio"}


@router.post("/webhook")
async def twilio_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook Twilio : reçu à chaque update de statut d'un SMS.

    Twilio envoie un POST avec form-data contenant :
    - MessageSid : SID du SMS (correspond à twilio_sid en DB)
    - MessageStatus : queued / sent / delivered / failed / undelivered
    - ErrorCode : code d'erreur Twilio si échec
    - To, From, AccountSid : metadata
    """
    form_data = await request.form()
    payload = dict(form_data)

    message_sid = payload.get("MessageSid", "")
    message_status = payload.get("MessageStatus", "")
    error_code = payload.get("ErrorCode")
    to_number = payload.get("To", "")

    logger.info(f"[TWILIO_WEBHOOK] Reçu : SID={message_sid} status={message_status} to={to_number} err={error_code}")

    # Validation signature Twilio
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    twilio_signature = request.headers.get("X-Twilio-Signature", "")

    if auth_token and twilio_signature:
        validator = RequestValidator(auth_token)
        url = str(request.url)
        is_valid = validator.validate(url, payload, twilio_signature)
        if not is_valid:
            logger.warning(f"[TWILIO_WEBHOOK] Signature invalide pour SID={message_sid}, ignoré")
            raise HTTPException(403, "Signature Twilio invalide")
    else:
        logger.warning(f"[TWILIO_WEBHOOK] Pas de signature Twilio (dev/test mode)")

    if not message_sid:
        return {"received": True, "updated": False}

    sms_log = db.query(SmsLog).filter(SmsLog.twilio_sid == message_sid).first()
    if not sms_log:
        logger.warning(f"[TWILIO_WEBHOOK] SMS log introuvable pour SID={message_sid}")
        return {"received": True, "updated": False, "reason": "sms_log_not_found"}

    new_status = _map_twilio_status(message_status)
    sms_log.status = new_status

    if new_status == SmsStatus.DELIVERED:
        sms_log.delivered_at = datetime.utcnow()

    if error_code:
        sms_log.error_message = f"Twilio error code: {error_code}"

    sms_log.twilio_response = {
        "MessageStatus": message_status,
        "ErrorCode": error_code,
        "received_at": datetime.utcnow().isoformat(),
    }

    db.commit()
    logger.info(f"[TWILIO_WEBHOOK] SMS {message_sid} -> {new_status.value}")

    return {"received": True, "updated": True, "new_status": new_status.value}
