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
    "signature.token_validity_days": {
        "value": "30",
        "type": SettingType.INTEGER,
        "description": "Durée de validité du lien de signature en jours",
    },
    "signature.legal_mention": {
        "value": "Bon pour accord — signé le {date}",
        "type": SettingType.STRING,
        "description": "Mention de signature obligatoire affichée au client",
    },
    "signature.single_use_token": {
        "value": "true",
        "type": SettingType.BOOLEAN,
        "description": "Lien à usage unique (invalidé après signature)",
    },
    "signature.require_handwritten_mention": {
        "value": "false",
        "type": SettingType.BOOLEAN,
        "description": "Demander au client de retaper la mention manuscrite",
    },
    # === PV par défaut ===
    "pv.default_logement_2_ans": {
        "value": "plus_de_2_ans",
        "type": SettingType.STRING,
        "description": "Ancienneté logement par defaut (plus_de_2_ans, moins_de_2_ans, ask_each)",
    },
    "pv.default_travaux_conformes": {
        "value": "true",
        "type": SettingType.BOOLEAN,
        "description": "Cocher 'Travaux conformes' par défaut sur le PV",
    },

    # === Section SMS templates (5 templates fideles au mockup phase2e) ===
    "sms.template_initial": {
        "value": "Bonjour {prenom}, votre intervention LBP du {date} à {heure} est confirmée. Merci de signer les documents nécessaires : {lien}. Pour toute question : 09 71 00 02 11. Les Bons Plombiers",
        "type": SettingType.STRING,
        "description": "SMS initial - envoyé à la création du RDV. Variables : {prenom}, {nom}, {date}, {heure}, {lien}",
    },
    "sms.template_initial_enabled": {
        "value": "true",
        "type": SettingType.BOOLEAN,
        "description": "Activer le SMS initial",
    },
    "sms.template_rappel_j1": {
        "value": "Rappel : intervention LBP demain {date} à {heure} chez vous. Si pas encore signé : {lien}. Bonne journée. Les Bons Plombiers",
        "type": SettingType.STRING,
        "description": "Rappel J-1 - envoyé la veille à 18h. Variables : {prenom}, {date}, {heure}, {lien}",
    },
    "sms.template_rappel_j1_enabled": {
        "value": "true",
        "type": SettingType.BOOLEAN,
        "description": "Activer le rappel J-1",
    },
    "sms.template_relance": {
        "value": "Bonjour {prenom}, il vous reste {nb_docs} document(s) à signer pour votre intervention du {date}. Merci de finaliser : {lien}. LBP",
        "type": SettingType.STRING,
        "description": "Relance signature - envoyée si pas signé apres 48h. Variables : {prenom}, {date}, {nb_docs}, {lien}",
    },
    "sms.template_relance_enabled": {
        "value": "true",
        "type": SettingType.BOOLEAN,
        "description": "Activer la relance signature",
    },
    "sms.template_deplacement": {
        "value": "Bonjour {prenom}, votre intervention LBP a été décalée au {date} à {heure}. Motif : {motif}. Documents : {lien}. LBP",
        "type": SettingType.STRING,
        "description": "Deplacement RDV - envoye apres modification du RDV. Variables : {prenom}, {date}, {heure}, {motif}, {lien}",
    },
    "sms.template_deplacement_enabled": {
        "value": "true",
        "type": SettingType.BOOLEAN,
        "description": "Activer le SMS de deplacement",
    },
    "sms.template_annulation": {
        "value": "Bonjour {prenom}, votre intervention LBP du {date} est annulée. Pour toute question : 09 71 00 02 11. LBP",
        "type": SettingType.STRING,
        "description": "Annulation - envoyé apres annulation cote outil. Variables : {prenom}, {date}",
    },
    "sms.template_annulation_enabled": {
        "value": "true",
        "type": SettingType.BOOLEAN,
        "description": "Activer le SMS d'annulation",
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
