"""Routes d'authentification."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from loguru import logger

from database import get_db
from models import User
from schemas.auth import LoginRequest, TokenResponse, UserResponse
from utils.security import verify_password, create_access_token
from utils.dependencies import get_current_user
from config import settings


router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login avec email + password.
    Retourne un JWT valide JWT_EXPIRATION_HOURS heures.
    """
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user or not verify_password(payload.password, user.password_hash):
        logger.warning(f"Login échoué pour : {payload.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )
    
    if user.is_active != "Y":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé"
        )
    
    # Mettre à jour last_login_at
    user.last_login_at = datetime.utcnow()
    db.commit()
    
    # Générer le JWT
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    
    logger.info(f"✅ Login réussi : {user.email} ({user.role.value})")
    
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in_hours=settings.JWT_EXPIRATION_HOURS
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Retourne les infos de l'utilisateur connecté."""
    return user
