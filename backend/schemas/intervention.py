"""Schemas Pydantic pour les interventions."""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from uuid import UUID
from typing import Optional, List

from models.intervention import InterventionStatus


# === Base (champs partagés) ===
class InterventionBase(BaseModel):
    client_nom: str = Field(min_length=1, max_length=255)
    client_prenom: str = Field(min_length=1, max_length=255)
    client_telephone: str = Field(min_length=8, max_length=50)
    client_email: Optional[EmailStr] = None
    client_adresse: Optional[str] = None
    client_code_postal: Optional[str] = Field(None, max_length=10)
    client_ville: Optional[str] = Field(None, max_length=255)
    
    date_rdv: datetime
    heure_rdv: Optional[str] = Field(None, max_length=20)
    duree_estimee: Optional[int] = Field(None, ge=15, le=480)  # 15min à 8h
    
    description_travaux: Optional[str] = None
    montant_devis_ht: Optional[int] = Field(None, ge=0)  # en centimes
    montant_devis_ttc: Optional[int] = Field(None, ge=0)
    logement_plus_2_ans: str = Field(default="Y", pattern="^[YN]$")


# === Pour création ===
class InterventionCreate(InterventionBase):
    google_event_id: Optional[str] = None


# === Pour mise à jour (tous champs optionnels) ===
class InterventionUpdate(BaseModel):
    client_nom: Optional[str] = Field(None, min_length=1, max_length=255)
    client_prenom: Optional[str] = Field(None, min_length=1, max_length=255)
    client_telephone: Optional[str] = Field(None, min_length=8, max_length=50)
    client_email: Optional[EmailStr] = None
    client_adresse: Optional[str] = None
    client_code_postal: Optional[str] = None
    client_ville: Optional[str] = None
    
    date_rdv: Optional[datetime] = None
    heure_rdv: Optional[str] = None
    duree_estimee: Optional[int] = None
    
    description_travaux: Optional[str] = None
    montant_devis_ht: Optional[int] = None
    montant_devis_ttc: Optional[int] = None
    logement_plus_2_ans: Optional[str] = Field(None, pattern="^[YN]$")
    
    status: Optional[InterventionStatus] = None


# === Réponse (lecture) ===
class InterventionResponse(InterventionBase):
    id: UUID
    google_event_id: Optional[str] = None
    status: InterventionStatus
    signature_token: Optional[str] = None
    signature_link_expires_at: Optional[datetime] = None
    sms_sent_count: int
    last_sms_sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    user_id: Optional[UUID] = None
    
    class Config:
        from_attributes = True


# === Réponse liste paginée ===
class InterventionListResponse(BaseModel):
    items: List[InterventionResponse]
    total: int
    page: int
    page_size: int
    pages: int


# === Stats pour dashboard ===
class InterventionStats(BaseModel):
    total: int
    pending: int
    sent: int
    signed: int
    partial: int
    expired: int
    cancelled: int
    today: int
    week: int
    month: int
