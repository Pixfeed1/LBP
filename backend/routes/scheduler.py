"""Routes admin scheduler : status + trigger manuel pour debug/test."""
from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from models.user import User, UserRole
from utils.dependencies import get_current_user
from services.scheduler_service import get_scheduler_status, trigger_job_now

router = APIRouter()


@router.get("/status")
def scheduler_status(current_user: User = Depends(get_current_user)):
    """Status du scheduler + liste des jobs avec next_run_time."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")
    return get_scheduler_status()


@router.post("/trigger/{job_id}")
def trigger_job(job_id: str, current_user: User = Depends(get_current_user)):
    """Trigger manuel d'un job (debug/test). Job IDs : rappel_j1 / relance_signatures."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Admin only")

    success = trigger_job_now(job_id)
    if not success:
        raise HTTPException(404, f"Job '{job_id}' inconnu. Disponibles : rappel_j1, relance_signatures")

    logger.info(f"[SCHEDULER] Job '{job_id}' trigger manuellement par {current_user.email}")
    return {"success": True, "job_id": job_id}
