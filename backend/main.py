"""
Point d'entrée du backend FastAPI — Les Bons Plombiers v2.
"""
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from loguru import logger
import sys

from config import settings
from database import engine, Base


# === Configuration des logs ===
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG" if settings.ENV == "development" else "INFO",
    colorize=True,
)
logger.add(
    "/app/logs/backend.log",
    rotation="10 MB",
    retention="30 days",
    level="INFO",
)


# === Lifecycle (startup/shutdown) ===
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Backend LBP v2 démarrage...")
    logger.info(f"   ENV: {settings.ENV}")
    logger.info(f"   API URL: {settings.API_URL}")
    logger.info(f"   APP URL: {settings.APP_URL}")
    
    # TODO: Créer les tables (en attendant Alembic)
    # Base.metadata.create_all(bind=engine)
    
    yield
    
    logger.info("👋 Backend LBP v2 arrêt...")


# === Création de l'app ===
app = FastAPI(
    title="LBP v2 — Signature électronique",
    description="API pour la gestion des signatures électroniques de Les Bons Plombiers",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENV == "development" else None,
    redoc_url=None,
)


# === CORS ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.APP_URL,
        "http://localhost:3010",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Routes ===
@app.get("/", status_code=status.HTTP_200_OK)
async def root():
    return {
        "service": "LBP v2 — Signature électronique",
        "version": "0.1.0",
        "status": "ok",
    }


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Healthcheck pour Docker et le monitoring."""
    try:
        # Test DB
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
        "checks": {
            "db": db_status,
        }
    }


# === Routes futures (à brancher au fur et à mesure) ===
# from routes import auth, interventions, signatures, settings as settings_routes
# app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
# app.include_router(interventions.router, prefix="/api/interventions", tags=["interventions"])
# app.include_router(signatures.router, prefix="/api/signatures", tags=["signatures"])
# app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
