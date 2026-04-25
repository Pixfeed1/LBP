"""Routes CRUD interventions."""
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from loguru import logger

from database import get_db
from models import User, Intervention, InterventionStatus
from schemas.intervention import (
    InterventionCreate, InterventionUpdate, InterventionResponse,
    InterventionListResponse, InterventionStats
)
from utils.dependencies import get_current_user


router = APIRouter()


@router.post("", response_model=InterventionResponse, status_code=status.HTTP_201_CREATED)
async def create_intervention(
    payload: InterventionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Créer une nouvelle intervention."""
    intervention = Intervention(
        **payload.model_dump(),
        user_id=user.id,
        status=InterventionStatus.PENDING
    )
    db.add(intervention)
    db.commit()
    db.refresh(intervention)
    
    logger.info(f"Intervention créée : {intervention.id} par {user.email}")
    return intervention


@router.get("", response_model=InterventionListResponse)
async def list_interventions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[InterventionStatus] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Recherche dans nom/prénom/téléphone"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Liste paginée des interventions avec filtres."""
    query = db.query(Intervention)
    
    if status_filter:
        query = query.filter(Intervention.status == status_filter)
    
    if search:
        s = f"%{search}%"
        query = query.filter(
            or_(
                Intervention.client_nom.ilike(s),
                Intervention.client_prenom.ilike(s),
                Intervention.client_telephone.ilike(s),
            )
        )
    
    if date_from:
        query = query.filter(Intervention.date_rdv >= date_from)
    if date_to:
        query = query.filter(Intervention.date_rdv <= date_to)
    
    total = query.count()
    pages = (total + page_size - 1) // page_size
    
    items = (
        query.order_by(Intervention.date_rdv.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    
    return InterventionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )


@router.get("/stats", response_model=InterventionStats)
async def get_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Statistiques des interventions pour le dashboard."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)
    
    total = db.query(Intervention).count()
    
    by_status = dict(
        db.query(Intervention.status, func.count(Intervention.id))
        .group_by(Intervention.status)
        .all()
    )
    
    today = db.query(Intervention).filter(Intervention.date_rdv >= today_start).count()
    week = db.query(Intervention).filter(Intervention.date_rdv >= week_start).count()
    month = db.query(Intervention).filter(Intervention.date_rdv >= month_start).count()
    
    return InterventionStats(
        total=total,
        pending=by_status.get(InterventionStatus.PENDING, 0),
        sent=by_status.get(InterventionStatus.SENT, 0),
        signed=by_status.get(InterventionStatus.SIGNED, 0),
        partial=by_status.get(InterventionStatus.PARTIAL, 0),
        expired=by_status.get(InterventionStatus.EXPIRED, 0),
        cancelled=by_status.get(InterventionStatus.CANCELLED, 0),
        today=today,
        week=week,
        month=month,
    )


@router.get("/{intervention_id}", response_model=InterventionResponse)
async def get_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Détail d'une intervention."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention introuvable")
    return intervention


@router.patch("/{intervention_id}", response_model=InterventionResponse)
async def update_intervention(
    intervention_id: UUID,
    payload: InterventionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Mettre à jour une intervention (champs partiels)."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention introuvable")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(intervention, key, value)
    
    intervention.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(intervention)
    
    logger.info(f"Intervention modifiée : {intervention.id} par {user.email}")
    return intervention


@router.delete("/{intervention_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intervention(
    intervention_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Supprimer une intervention (cascade sur documents et signatures)."""
    intervention = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not intervention:
        raise HTTPException(status_code=404, detail="Intervention introuvable")
    
    db.delete(intervention)
    db.commit()
    
    logger.info(f"Intervention supprimée : {intervention_id} par {user.email}")
    return None
