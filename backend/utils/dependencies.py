"""Dependencies FastAPI pour injection (auth, DB)."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from uuid import UUID

from database import get_db
from models import User, UserRole
from utils.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Extrait l'utilisateur depuis le JWT. Lève 401 si invalide."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants invalides",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    try:
        user = db.query(User).filter(User.id == UUID(user_id)).first()
    except (ValueError, AttributeError):
        raise credentials_exception
    
    if user is None or user.is_active != "Y":
        raise credentials_exception
    
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur a le rôle ADMIN."""
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès admin requis"
        )
    return user


def require_manager_or_admin(user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est manager ou admin."""
    if user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès manager requis"
        )
    return user
