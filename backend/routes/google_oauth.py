"""Routes OAuth Google : login flow + callback."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from loguru import logger

from database import get_db
from config import settings
from services import google_oauth_service
from models.user import User
from utils.dependencies import get_current_user_optional


router = APIRouter()


@router.get("/login")
async def google_login(
    request: Request,
    user: User = Depends(get_current_user_optional),
):
    """Redirige l'utilisateur vers la page d'autorisation Google.

    Le user_id est passe dans le state pour qu'on puisse l'associer
    aux credentials apres le callback.
    """
    if not google_oauth_service.is_configured():
        raise HTTPException(status_code=500, detail="Google OAuth non configure cote serveur")

    # State = token CSRF + user_id encode (pour pouvoir associer apres callback)
    state_token = google_oauth_service.generate_state_token()
    user_id = str(user.id) if user else ""
    state = f"{state_token}::{user_id}"

    auth_url = google_oauth_service.build_auth_url(state)
    logger.info(f"[GOAUTH] Redirection user {user_id or 'anonymous'} vers Google")
    return RedirectResponse(url=auth_url, status_code=302)


@router.get("/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    error: str = Query(None),
    db: Session = Depends(get_db),
):
    """Callback OAuth : Google nous renvoie un code, on l'echange contre des tokens."""
    if error:
        logger.error(f"[GOAUTH] Callback erreur Google : {error}")
        return RedirectResponse(
            url=f"{settings.APP_URL}/dashboard/calendrier?google_error={error}",
            status_code=302,
        )

    # Decode le state pour recup user_id
    parts = state.split("::")
    user_id = parts[1] if len(parts) > 1 and parts[1] else None

    try:
        # Echange code contre tokens
        tokens = google_oauth_service.exchange_code_for_tokens(code)
        # Recupere l'email de l'utilisateur Google
        access_token = tokens["access_token"]
        google_email = google_oauth_service.get_user_email(access_token)
        # Sauvegarde en DB
        creds = google_oauth_service.save_credentials(db, user_id, tokens, google_email)
        logger.info(f"[GOAUTH] Connexion Google reussie pour {google_email}")
        # Redirige vers le dashboard calendrier avec un flag de succes
        return RedirectResponse(
            url=f"{settings.APP_URL}/dashboard/calendrier?google_connected=1",
            status_code=302,
        )
    except Exception as e:
        logger.exception(f"[GOAUTH] Echec callback : {e}")
        return RedirectResponse(
            url=f"{settings.APP_URL}/dashboard/calendrier?google_error=callback_failed",
            status_code=302,
        )


@router.post("/disconnect")
async def google_disconnect(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_optional),
):
    """Deconnecte le compte Google (desactive les credentials)."""
    user_id = str(user.id) if user else None
    count = google_oauth_service.disconnect(db, user_id)
    return {"success": True, "disconnected_count": count}
