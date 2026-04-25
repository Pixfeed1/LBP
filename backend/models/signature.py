"""Signature model — preuve juridique d'une signature client."""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from database import Base


class SignatureStatus(str, enum.Enum):
    PENDING = "pending"
    SIGNED = "signed"
    REJECTED = "rejected"


class Signature(Base):
    __tablename__ = "signatures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    intervention_id = Column(UUID(as_uuid=True), ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    status = Column(SQLEnum(SignatureStatus), default=SignatureStatus.PENDING, nullable=False)
    
    # Données de signature (canvas data URL pour mode "maison")
    signature_image = Column(Text, nullable=True)  # base64 PNG
    
    # Preuves juridiques
    signed_at = Column(DateTime, nullable=True)
    signer_ip = Column(String(45), nullable=True)  # IPv6 max
    signer_user_agent = Column(Text, nullable=True)
    signer_name_typed = Column(String(255), nullable=True)  # nom retapé
    signer_consent_text = Column(Text, nullable=True)  # mention manuscrite
    hash_sha256 = Column(String(64), nullable=True)
    
    # Provider info
    provider = Column(String(50), default="maison", nullable=False)
    yousign_signature_id = Column(String(255), nullable=True)
    
    # Métadonnées (JSON flexible)
    metadata_json = Column(JSONB, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relations
    intervention = relationship("Intervention", back_populates="signatures")
    document = relationship("Document", back_populates="signatures")
