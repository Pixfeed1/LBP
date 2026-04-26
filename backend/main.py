"""Point d entree du backend FastAPI."""
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import sys

from config import settings
from database import engine
from routes import auth as auth_routes, signatures as signatures_routes, users
from routes import sms as sms_routes
from routes import settings as settings_routes
from routes import interventions as interventions_routes
from routes import calendar as calendar_routes
from routes import documents as documents_routes
from routes import public_signature as public_signature_routes
from routes import public_twilio as public_twilio_routes


# === Logs ===
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG" if settings.ENV == "development" else "INFO",
    colorize=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Backend LBP v2 demarrage...")
    logger.info(f"   ENV: {settings.ENV}")
    logger.info(f"   API URL: {settings.API_URL}")
    yield
    logger.info("Backend LBP v2 arret...")


app = FastAPI(
    title="LBP v2 - Signature electronique",
    description="API pour la gestion des signatures electroniques",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENV == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.APP_URL,
        "https://lesbonsplombiers.pixfeed.net",
        "http://localhost:3010",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"service": "LBP v2", "version": "0.1.0", "status": "ok"}


@app.get("/health")
async def health_check():
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        logger.error(f"DB healthcheck failed: {e}")
        db_status = "error"
    
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "version": "0.1.0",
        "checks": {"db": db_status}
    }


# === Routes ===
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(interventions_routes.router, prefix="/api/interventions", tags=["interventions"])
app.include_router(signatures_routes.router, prefix="/api/signatures", tags=["signatures"])
app.include_router(sms_routes.router, prefix="/api/sms", tags=["sms"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(calendar_routes.router, prefix="/api/calendar", tags=["calendar"])
app.include_router(documents_routes.router, prefix="/api/documents", tags=["documents"])
app.include_router(public_signature_routes.router, prefix="/api/public/signature", tags=["public-signature"])
app.include_router(public_twilio_routes.router, prefix="/api/public/twilio", tags=["public-twilio"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
