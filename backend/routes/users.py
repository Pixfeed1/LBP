"""Routes CRUD utilisateurs — admin only."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import secrets
import string
from passlib.context import CryptContext
from datetime import datetime
from loguru import logger

from database import get_db
from models.user import User, UserRole
from schemas.user import (
    UserCreate, UserUpdate, UserResetPassword, UserSelfUpdate,
    UserResponseFull, UserStatsResponse, UserRoleSchema
)
from utils.dependencies import get_current_user

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _to_response(user: User) -> dict:
    """Convertit un User en dict pour response."""
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "is_active": user.is_active,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "last_login_at": user.last_login_at,
    }


def _generate_temp_password() -> str:
    """Génère un mot de passe temporaire (12 chars alphanumeriques + 2 specials)."""
    alphabet = string.ascii_letters + string.digits
    pwd = "".join(secrets.choice(alphabet) for _ in range(12))
    return pwd + "!@"  # Force complexité


@router.get("", response_model=List[UserResponseFull])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[str] = None,
    role: Optional[str] = None,
):
    """Liste tous les users — admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Seuls les administrateurs peuvent lister les utilisateurs")

    query = db.query(User)
    if is_active in ("Y", "N"):
        query = query.filter(User.is_active == is_active)
    if role:
        try:
            role_enum = UserRole(role.lower())
            query = query.filter(User.role == role_enum)
        except ValueError:
            pass

    users = query.order_by(User.created_at.desc()).all()
    return [_to_response(u) for u in users]


@router.get("/stats", response_model=UserStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stats sur les users — admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Réservé aux administrateurs")

    total = db.query(User).count()
    active = db.query(User).filter(User.is_active == "Y").count()
    inactive = total - active

    by_role = {}
    for r in UserRole:
        count = db.query(User).filter(User.role == r).count()
        by_role[r.value] = count

    return UserStatsResponse(total=total, active=active, inactive=inactive, by_role=by_role)


@router.post("", response_model=dict)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crée un nouvel user — admin only. Renvoie le user + le mot de passe temporaire."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Seuls les administrateurs peuvent inviter des membres")

    # Verif email unique
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(400, "Un utilisateur avec cet email existe déjà")

    # Mot de passe : utilisateur fourni ou généré
    if payload.password:
        temp_password = payload.password
        password_was_generated = False
    else:
        temp_password = _generate_temp_password()
        password_was_generated = True

    user = User(
        email=payload.email.lower(),
        name=payload.name.strip(),
        role=UserRole(payload.role.value),
        password_hash=pwd_context.hash(temp_password),
        is_active="Y",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info(f"✅ User créé : {user.email} ({user.role.value}) par {current_user.email}")

    return {
        "user": _to_response(user),
        "temp_password": temp_password if password_was_generated else None,
        "password_generated": password_was_generated,
    }


@router.patch("/{user_id}", response_model=UserResponseFull)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Modifie un user — admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Réservé aux administrateurs")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilisateur non trouvé")

    # Empêche un admin de se rétrograder lui-même (sécurité - sinon plus aucun admin)
    if str(user.id) == str(current_user.id) and payload.role and payload.role != UserRoleSchema.ADMIN:
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == "Y").count()
        if admin_count <= 1:
            raise HTTPException(400, "Vous ne pouvez pas vous rétrograder : il faut au moins un administrateur actif")

    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.role is not None:
        user.role = UserRole(payload.role.value)
    if payload.is_active is not None:
        # Empêche désactivation du dernier admin
        if str(user.id) == str(current_user.id) and payload.is_active == "N":
            raise HTTPException(400, "Vous ne pouvez pas vous désactiver vous-même")
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)

    logger.info(f"✅ User {user.email} modifié par {current_user.email}")
    return _to_response(user)


@router.post("/{user_id}/reset-password", response_model=dict)
def reset_password(
    user_id: str,
    payload: UserResetPassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset password d'un user — admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Réservé aux administrateurs")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilisateur non trouvé")

    user.password_hash = pwd_context.hash(payload.new_password)
    db.commit()

    logger.info(f"🔑 Password reset pour {user.email} par {current_user.email}")
    return {"success": True, "message": f"Mot de passe réinitialisé pour {user.email}"}


@router.delete("/{user_id}", response_model=dict)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Désactive (soft delete) un user — admin only."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Réservé aux administrateurs")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilisateur non trouvé")

    if str(user.id) == str(current_user.id):
        raise HTTPException(400, "Vous ne pouvez pas vous désactiver vous-même")

    # Empêche désactivation du dernier admin
    if user.role == UserRole.ADMIN:
        admin_count = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == "Y").count()
        if admin_count <= 1:
            raise HTTPException(400, "Impossible de désactiver le dernier administrateur")

    user.is_active = "N"
    db.commit()

    logger.info(f"🔒 User {user.email} désactivé par {current_user.email}")
    return {"success": True, "message": f"{user.name} désactivé"}
