"""Document model — PDFs générés par intervention (PV, Attestation TVA, Délégation)."""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from database import Base


class DocumentType(str, enum.Enum):
    PROCES_VERBAL = "proces_verbal"
    ATTESTATION_TVA = "attestation_tva"
    DELEGATION_PAIEMENT = "delegation_paiement"
    FICHE_TRAVAUX = "fiche_travaux"


class DocumentStatus(str, enum.Enum):
    PENDING = "pending"        # Généré, pas encore envoyé à signer
    SENT = "sent"              # Envoyé pour signature
    SIGNED = "signed"          # Signé
    REJECTED = "rejected"      # Refusé par le client
    EXPIRED = "expired"        # Lien expiré


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    intervention_id = Column(UUID(as_uuid=True), ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False, index=True)
    
    type = Column(SQLEnum(DocumentType), nullable=False)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.PENDING, nullable=False, index=True)
    
    # Fichiers
    file_path_unsigned = Column(Text, nullable=True)
    file_path_signed = Column(Text, nullable=True)
    
    # Yousign
    yousign_request_id = Column(String(255), nullable=True, index=True)
    yousign_document_id = Column(String(255), nullable=True)
    yousign_signature_link = Column(Text, nullable=True)
    
    # Maison
    signature_provider = Column(String(50), default="maison", nullable=False)  # "maison" ou "yousign"
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    signed_at = Column(DateTime, nullable=True)
    
    # Relations
    intervention = relationship("Intervention", back_populates="documents")
    signatures = relationship("Signature", back_populates="document", cascade="all, delete-orphan")
