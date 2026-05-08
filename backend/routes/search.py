"""Route de recherche globale dashboard.

Cherche dans les interventions sur :
- nom client
- prenom client
- telephone (avec normalisation)
- code postal / ville
- description travaux
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from database import get_db
from models import User
from models.intervention import Intervention
from utils.dependencies import get_current_user


router = APIRouter()


class SearchResult(BaseModel):
    id: str
    type: str  # "intervention" pour l'instant
    title: str
    subtitle: Optional[str] = None
    status: Optional[str] = None
    link: str

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    query: str


def _format_result(intv: Intervention) -> SearchResult:
    """Formatte une intervention en SearchResult."""
    name_parts = [intv.client_prenom or "", intv.client_nom or ""]
    name = " ".join(p for p in name_parts if p).strip() or "Sans nom"

    # Subtitle : date + travaux
    subtitle_parts = []
    if intv.date_rdv:
        subtitle_parts.append(intv.date_rdv.strftime("%d/%m %Hh%M"))
    if intv.description_travaux:
        desc = intv.description_travaux[:60]
        if len(intv.description_travaux) > 60:
            desc += "..."
        subtitle_parts.append(desc)
    elif intv.client_ville:
        subtitle_parts.append(intv.client_ville)

    subtitle = " · ".join(subtitle_parts) if subtitle_parts else None

    status = intv.status.value.lower() if hasattr(intv.status, "value") else str(intv.status).lower()

    return SearchResult(
        id=str(intv.id),
        type="intervention",
        title=name,
        subtitle=subtitle,
        status=status,
        link=f"/dashboard/interventions/{intv.id}",
    )


@router.get("", response_model=SearchResponse)
async def search_global(
    q: str = Query(..., min_length=1, max_length=100, description="Terme de recherche"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Recherche globale dans les interventions."""
    query_str = q.strip()

    # Normaliser le telephone : retirer espaces, points, tirets
    phone_normalized = "".join(c for c in query_str if c.isdigit() or c == "+")

    # Construire le filtre OR
    pattern = f"%{query_str}%"
    pattern_lower = f"%{query_str.lower()}%"

    filters = [
        func.lower(Intervention.client_nom).like(pattern_lower),
        func.lower(Intervention.client_prenom).like(pattern_lower),
        func.lower(Intervention.client_ville).like(pattern_lower),
        func.lower(Intervention.client_adresse).like(pattern_lower),
        func.lower(Intervention.description_travaux).like(pattern_lower),
        Intervention.client_code_postal.like(pattern),
    ]

    # Si on a un pattern numerique, chercher aussi dans le telephone
    if phone_normalized and len(phone_normalized) >= 3:
        # Telephone DB peut contenir +33... ou 06... etc, on cherche un sous-ensemble
        filters.append(Intervention.client_telephone.like(f"%{phone_normalized}%"))

    interventions = (
        db.query(Intervention)
        .filter(or_(*filters))
        .order_by(Intervention.date_rdv.desc().nullslast())
        .limit(limit)
        .all()
    )

    # Compter le total (pour info dans la response)
    total = (
        db.query(func.count(Intervention.id))
        .filter(or_(*filters))
        .scalar()
    )

    return SearchResponse(
        results=[_format_result(intv) for intv in interventions],
        total=total or 0,
        query=query_str,
    )
