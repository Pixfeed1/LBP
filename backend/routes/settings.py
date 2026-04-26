"""Routes de gestion des settings globaux (configuration LBP v2)."""
from datetime import datetime
from typing import Optional, List, Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Setting, SettingType
from utils.dependencies import get_current_user
from models.user import User, UserRole

router = APIRouter()


# ============================================================
# DEFAULT SETTINGS (graine si DB vide)
# ============================================================

DEFAULT_SETTINGS: Dict[str, Dict[str, Any]] = {
    # === Section Signature ===
    "signature.default_provider": {
        "value": "maison",
        "type": SettingType.STRING,
        "description": "Provider de signature par défaut (maison ou yousign)",
    },
    "signature.token_validity_hours": {
        "value": "168",  # 7 jours
        "type": SettingType.INTEGER,
        "description": "Durée de validité du token de signature en heures",
    },
    "signature.consent_text": {
        "value": "lu et approuvé",
        "type": SettingType.STRING,
        "description": "Mention juridique manuscrite que le client doit retaper",
    },
    "signature.logement_default_2_ans": {
        "value": "Y",
        "type": SettingType.STRING,
        "description": "Logement plus de 2 ans par défaut (Y/N) pour TVA réduite",
    },

    # === Section SMS templates ===
    "sms.template_signature_initial": {
        "value": "Bonjour {prenom}, suite a votre intervention par Les Bons Plombiers, merci de signer vos documents : {url}",
        "type": SettingType.STRING,
        "description": "Template du SMS de signature initial. Variables : {prenom}, {nom}, {url}",
    },
    "sms.template_signature_relance": {
        "value": "Bonjour {prenom}, n'oubliez pas de signer vos documents Les Bons Plombiers : {url}",
        "type": SettingType.STRING,
        "description": "Template du SMS de relance. Variables : {prenom}, {nom}, {url}",
    },
    "sms.template_rdv_rappel": {
        "value": "Rappel : votre intervention Les Bons Plombiers est prevue {date} a {heure}.",
        "type": SettingType.STRING,
        "description": "Template du SMS de rappel RDV. Variables : {prenom}, {nom}, {date}, {heure}",
    },
    "sms.relance_enabled": {
        "value": "false",
        "type": SettingType.BOOLEAN,
        "description": "Activer la relance automatique J-1",
    },

    # === Section Notifications ===
    "notif.admin_emails": {
        "value": "moosyne@gmail.com",
        "type": SettingType.STRING,
        "description": "Emails recevant les notifs (separés par virgule)",
    },
    "notif.daily_recap_enabled": {
        "value": "false",
        "type": SettingType.BOOLEAN,
        "description": "Recevoir un récap quotidien des signatures",
    },
    "notif.daily_recap_hour": {
        "value": "18",
        "type": SettingType.INTEGER,
        "description": "Heure d'envoi du récap quotidien (0-23)",
    },

    # === Section Archivage ===
    "archive.gdrive_enabled": {
        "value": "false",
        "type": SettingType.BOOLEAN,
        "description": "Archiver les PDFs signés sur Google Drive",
    },
    "archive.gdrive_folder_id": {
        "value": "",
        "type": SettingType.STRING,
        "description": "ID du dossier Google Drive de destination",
    },
}


# ============================================================
# SCHEMAS
# ============================================================

class SettingItem(BaseModel):
    key: str
    value: str
    type: str
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettingsUpdate(BaseModel):
    settings: Dict[str, str]  # key -> value


# ============================================================
# Helpers
# ============================================================

def _seed_defaults_if_missing(db: Session) -> None:
    """Crée les settings par défaut si la DB ne les contient pas."""
    existing_keys = {s.key for s in db.query(Setting.key).all()}
    added = 0
    for key, meta in DEFAULT_SETTINGS.items():
        if key not in existing_keys:
            new = Setting(
                key=key,
                value=meta["value"],
                type=meta["type"],
                description=meta.get("description"),
            )
            db.add(new)
            added += 1
    if added > 0:
        db.commit()


# ============================================================
# ROUTES
# ============================================================

@router.get("", response_model=List[SettingItem])
async def list_settings(
    prefix: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Liste tous les settings (filtrable par prefix : 'signature.', 'sms.', etc.)."""
    _seed_defaults_if_missing(db)

    query = db.query(Setting)
    if prefix:
        query = query.filter(Setting.key.startswith(prefix))
    query = query.order_by(Setting.key)

    rows = query.all()
    return [
        SettingItem(
            key=r.key,
            value=r.value or "",
            type=r.type.value if hasattr(r.type, "value") else str(r.type),
            description=r.description,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/{key:path}", response_model=SettingItem)
async def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Récupère un setting par sa clé."""
    _seed_defaults_if_missing(db)

    setting = db.query(Setting).filter(Setting.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' non trouvé")

    return SettingItem(
        key=setting.key,
        value=setting.value or "",
        type=setting.type.value if hasattr(setting.type, "value") else str(setting.type),
        description=setting.description,
        updated_at=setting.updated_at,
    )


@router.put("", response_model=List[SettingItem])
async def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update batch de settings. Seuls les ADMIN peuvent modifier."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Seuls les admins peuvent modifier la configuration")

    _seed_defaults_if_missing(db)

    updated = []
    for key, value in payload.settings.items():
        setting = db.query(Setting).filter(Setting.key == key).first()
        if not setting:
            # Si la clé n'existe pas dans DEFAULT_SETTINGS on refuse (sécurité)
            if key not in DEFAULT_SETTINGS:
                continue
            meta = DEFAULT_SETTINGS[key]
            setting = Setting(
                key=key,
                value=value,
                type=meta["type"],
                description=meta.get("description"),
            )
            db.add(setting)
        else:
            setting.value = value
            setting.updated_at = datetime.utcnow()

        updated.append(setting)

    db.commit()

    # Refresh tous les settings updated
    for s in updated:
        db.refresh(s)

    return [
        SettingItem(
            key=s.key,
            value=s.value or "",
            type=s.type.value if hasattr(s.type, "value") else str(s.type),
            description=s.description,
            updated_at=s.updated_at,
        )
        for s in updated
    ]
