"""Dependencies FastAPI pour injection (auth, DB)."""
from fastapi import Depends, HTTPException, status, Request
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


def get_current_user_optional(
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Version optionnelle : retourne le user si token valide, sinon None.

    Utile pour les routes OAuth callback ou la version /login qui peut etre
    appelee avec ou sans user logue.
    """
    if request is None:
        return None
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        return get_current_user_from_token(auth_header.replace("Bearer ", ""), db)
    except Exception:
        return None


def get_current_user_from_token(token: str, db: Session):
    """Decode le token JWT et retourne le user, raise si invalide."""
    from jose import jwt, JWTError
    from config import settings
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_email = payload.get("sub")
        if not user_email:
            return None
    except JWTError:
        return None
    from models.user import User
    return db.query(User).filter(User.email == user_email).first()

