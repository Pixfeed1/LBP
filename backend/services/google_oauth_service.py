"""Service OAuth 2.0 pour Google Calendar.

Workflow OAuth :
1. build_auth_url() : genere l'URL d'autorisation Google avec state CSRF
2. exchange_code_for_tokens() : echange le code contre access_token + refresh_token
3. refresh_access_token() : utilise refresh_token pour obtenir un nouveau access_token
4. get_user_email() : recupere l'email Google de l'utilisateur connecte
5. save_credentials() / get_active_credentials() : persistance DB
"""
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from urllib.parse import urlencode
import requests
from loguru import logger
from sqlalchemy.orm import Session

from config import settings
from models.google_credentials import GoogleCredentials


# Scope minimum : lecture seule du calendrier
GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
GOOGLE_USERINFO_SCOPE = "https://www.googleapis.com/auth/userinfo.email"
SCOPES = [GOOGLE_CALENDAR_SCOPE, GOOGLE_USERINFO_SCOPE]

# URLs Google OAuth
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def is_configured() -> bool:
    """Verifie que les creds Google OAuth sont en place."""
    return all([
        settings.GOOGLE_CLIENT_ID,
        settings.GOOGLE_CLIENT_SECRET,
        settings.GOOGLE_REDIRECT_URI,
    ])


def build_auth_url(state: str) -> str:
    """Genere l'URL d'autorisation Google.

    Args:
        state: Token CSRF aleatoire pour valider le callback

    Returns:
        URL complete vers laquelle rediriger l'utilisateur
    """
    if not is_configured():
        raise ValueError("Google OAuth non configure")

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",  # pour avoir refresh_token
        "prompt": "consent",  # force le consent screen pour avoir le refresh_token
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def generate_state_token() -> str:
    """Genere un token CSRF aleatoire pour le state OAuth."""
    return secrets.token_urlsafe(32)


def exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    """Echange un code OAuth contre access_token + refresh_token.

    Returns:
        dict avec access_token, refresh_token, expires_in, scope
    """
    payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    logger.info("[GOAUTH] Echange code -> tokens...")
    resp = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
    resp.raise_for_status()
    tokens = resp.json()
    logger.info(f"[GOAUTH] Tokens recus, expires_in={tokens.get('expires_in')}s")
    return tokens


def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    """Utilise un refresh_token pour obtenir un nouveau access_token."""
    payload = {
        "refresh_token": refresh_token,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "grant_type": "refresh_token",
    }

    logger.info("[GOAUTH] Refresh access_token...")
    resp = requests.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
    resp.raise_for_status()
    new_tokens = resp.json()
    logger.info("[GOAUTH] Access_token rafraichi")
    return new_tokens


def get_user_email(access_token: str) -> str:
    """Recupere l'email Google de l'utilisateur connecte."""
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(GOOGLE_USERINFO_URL, headers=headers, timeout=10)
    resp.raise_for_status()
    info = resp.json()
    return info.get("email", "")


def save_credentials(
    db: Session,
    user_id: Optional[str],
    tokens: Dict[str, Any],
    email: str,
) -> GoogleCredentials:
    """Sauvegarde ou met a jour les credentials d'un utilisateur en DB.

    Si l'utilisateur a deja des creds actives, on les desactive et on en cree
    une nouvelle. Permet de garder un historique.
    """
    # Desactiver les anciennes credentials du meme user
    if user_id:
        db.query(GoogleCredentials).filter(
            GoogleCredentials.user_id == user_id,
            GoogleCredentials.is_active == True,
        ).update({"is_active": False})

    expires_at = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))

    creds = GoogleCredentials(
        user_id=user_id,
        google_email=email,
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token", ""),
        token_expires_at=expires_at,
        scopes=tokens.get("scope", ""),
        is_active=True,
    )
    db.add(creds)
    db.commit()
    db.refresh(creds)
    logger.info(f"[GOAUTH] Credentials sauvegardes pour {email}")
    return creds


def get_active_credentials(db: Session, user_id: Optional[str] = None) -> Optional[GoogleCredentials]:
    """Recupere les credentials actives.

    Si user_id fourni, cherche pour cet user. Sinon, retourne les premieres
    actives trouvees (utile pour le scheduler qui sync sans contexte user).
    """
    q = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True)
    if user_id:
        q = q.filter(GoogleCredentials.user_id == user_id)
    return q.first()


def get_valid_access_token(db: Session, creds: GoogleCredentials) -> str:
    """Retourne un access_token valide. Refresh si expire.

    Side effect : update creds en DB si refresh effectue.
    """
    # Si expire dans moins de 60s, on refresh par precaution
    if creds.token_expires_at and creds.token_expires_at <= datetime.utcnow() + timedelta(seconds=60):
        new_tokens = refresh_access_token(creds.refresh_token)
        creds.access_token = new_tokens["access_token"]
        creds.token_expires_at = datetime.utcnow() + timedelta(seconds=new_tokens.get("expires_in", 3600))
        # Le refresh_token peut aussi etre renouvele (rare)
        if "refresh_token" in new_tokens:
            creds.refresh_token = new_tokens["refresh_token"]
        db.commit()
    return creds.access_token


def disconnect(db: Session, user_id: Optional[str] = None) -> int:
    """Desactive les credentials actives d'un user (logout Google).

    Returns:
        Nombre de creds desactivees.
    """
    q = db.query(GoogleCredentials).filter(GoogleCredentials.is_active == True)
    if user_id:
        q = q.filter(GoogleCredentials.user_id == user_id)
    count = q.update({"is_active": False})
    db.commit()
    logger.info(f"[GOAUTH] {count} credentials desactivees")
    return count
