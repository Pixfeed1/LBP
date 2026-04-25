"""Schemas Pydantic pour le workflow signature."""
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional, List

from models.document import DocumentType, DocumentStatus


class DocumentResponse(BaseModel):
    id: UUID
    intervention_id: UUID
    type: DocumentType
    status: DocumentStatus
    file_path_unsigned: Optional[str] = None
    file_path_signed: Optional[str] = None
    signature_provider: str
    yousign_request_id: Optional[str] = None
    yousign_signature_link: Optional[str] = None
    created_at: datetime
    signed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SendSignatureRequest(BaseModel):
    """Requête pour déclencher l'envoi en signature."""
    provider: str = "maison"  # "maison" ou "yousign"
    document_types: Optional[List[DocumentType]] = None  # Si None, génère tous
    expires_in_days: int = 7


class SendSignatureResponse(BaseModel):
    """Réponse après envoi en signature."""
    intervention_id: UUID
    signature_token: str
    signature_url: str
    expires_at: datetime
    documents_generated: int
    documents: List[DocumentResponse]
    sms_to_send: bool = True  # Sera True quand SMS sera implémenté
