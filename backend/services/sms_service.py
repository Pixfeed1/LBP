"""
Service SMS via Twilio + log en DB.
Logge chaque envoi dans la table sms_logs (audit trail).
"""
import os
import logging
from typing import Optional
from uuid import UUID

import requests
from sqlalchemy.orm import Session

from models.sms_log import SmsLog, SmsType, SmsStatus

logger = logging.getLogger(__name__)


def _normalize_phone(phone: str) -> str:
    """Normalise le numéro au format E.164 (+33...)."""
    phone = phone.strip().replace(" ", "").replace(".", "").replace("-", "")
    if phone.startswith("0"):
        return "+33" + phone[1:]
    if not phone.startswith("+"):
        return "+" + phone
    return phone


def send_sms_twilio(
    to_number: str,
    message: str,
    db: Optional[Session] = None,
    intervention_id: Optional[UUID] = None,
    sms_type: SmsType = SmsType.SIGNATURE_INITIAL,
) -> dict:
    """
    Envoie un SMS via Twilio + log en DB si session fournie.

    Args:
        to_number: Numéro du destinataire (sera normalisé en E.164)
        message: Corps du SMS
        db: Session SQLAlchemy (optionnel, mais nécessaire pour logger)
        intervention_id: UUID de l'intervention liée (optionnel)
        sms_type: Type de SMS (signature_initial, relance, etc.)

    Returns:
        Dict Twilio (sid, status, etc.) + log_id si DB fournie

    Raises:
        Exception: Si Twilio non configuré ou erreur réseau
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    from_number = os.getenv("TWILIO_FROM_NUMBER", "").strip()

    if not all([account_sid, auth_token, from_number]):
        raise Exception(
            "Twilio non configuré. Renseignez TWILIO_ACCOUNT_SID, "
            "TWILIO_AUTH_TOKEN et TWILIO_FROM_NUMBER dans .env"
        )

    to_normalized = _normalize_phone(to_number)
    logger.info(f"[TWILIO] Envoi SMS à {to_normalized} depuis {from_number}")

    # Créer le log AVANT l'envoi (status=pending)
    sms_log = None
    if db is not None:
        sms_log = SmsLog(
            intervention_id=intervention_id,
            phone=to_normalized,
            message=message,
            sms_type=sms_type,
            status=SmsStatus.PENDING,
        )
        db.add(sms_log)
        db.commit()
        db.refresh(sms_log)

    try:
        resp = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
            auth=(account_sid, auth_token),
            data={"From": from_number, "To": to_normalized, "Body": message,
"StatusCallback": os.getenv("TWILIO_STATUS_CALLBACK_URL", ""),
},
            timeout=15,
        )
        resp.raise_for_status()
        result = resp.json()
        sid = result.get("sid", "?")
        twilio_status = result.get("status", "?")
        logger.info(f"[TWILIO] SMS envoyé ! SID={sid}, status={twilio_status}")

        # Update log avec succès
        if sms_log and db is not None:
            sms_log.twilio_sid = sid
            sms_log.twilio_response = result
            sms_log.status = SmsStatus.SENT
            db.commit()

        return result

    except requests.HTTPError as e:
        error_body = e.response.text if e.response else str(e)
        logger.error(f"[TWILIO] Erreur HTTP : {error_body}")

        if sms_log and db is not None:
            sms_log.status = SmsStatus.FAILED
            sms_log.error_message = error_body[:1000]
            db.commit()

        raise Exception(f"Erreur Twilio : {error_body}")

    except Exception as e:
        logger.error(f"[TWILIO] Erreur : {e}")

        if sms_log and db is not None:
            sms_log.status = SmsStatus.FAILED
            sms_log.error_message = str(e)[:1000]
            db.commit()

        raise


def _fetch_setting_sync(key: str) -> str:
    """Lit un setting depuis la DB (utilitaire local)."""
    from sqlalchemy.orm import sessionmaker
    from database import engine
    from models.setting import Setting
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        setting = db.query(Setting).filter(Setting.key == key).first()
        return setting.value if setting else None
    finally:
        db.close()


def build_signature_sms_message(client_name: str, signature_url: str, prenom: str = "", nom: str = "") -> str:
    """Construit le corps du SMS de signature en utilisant le template configure en DB.
    
    Variables supportees: {prenom}, {nom}, {url}, {lien}
    Fallback sur message hardcoded si template absent.
    """
    # Lire le template configure (signature_initial en priorite, sinon initial, sinon hardcoded)
    template = _fetch_setting_sync("sms.template_signature_initial") or _fetch_setting_sync("sms.template_initial")
    
    if template:
        # Variables : si prenom/nom non fournis, deduire depuis client_name
        if not prenom and client_name:
            parts = client_name.split()
            prenom = parts[0] if parts else ""
            nom = " ".join(parts[1:]) if len(parts) > 1 else ""
        
        replacements = {
            "{prenom}": prenom or "",
            "{nom}": nom or "",
            "{url}": signature_url,
            "{lien}": signature_url,
        }
        msg = template
        for key, value in replacements.items():
            msg = msg.replace(key, value)
        return msg
    
    # Fallback historique
    return (
        f"Bonjour {client_name}, suite a votre intervention par Les Bons Plombiers, "
        f"merci de signer vos documents : {signature_url}"
    )
