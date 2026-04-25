"""Intervention model — un RDV programmé chez un client."""
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from database import Base


class InterventionStatus(str, enum.Enum):
    PENDING = "pending"           # Créée, pas encore envoyée
    SENT = "sent"                  # SMS envoyé au client
    SIGNED = "signed"              # Tous les docs signés
    PARTIAL = "partial"            # Certains docs signés
    EXPIRED = "expired"            # Lien expiré
    CANCELLED = "cancelled"        # Annulée


class Intervention(Base):
    __tablename__ = "interventions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Référence Google Calendar
    google_event_id = Column(String(255), unique=True, nullable=True, index=True)
    
    # Client
    client_nom = Column(String(255), nullable=False)
    client_prenom = Column(String(255), nullable=False)
    client_email = Column(String(255), nullable=True)
    client_telephone = Column(String(50), nullable=False)
    client_adresse = Column(Text, nullable=True)
    client_code_postal = Column(String(10), nullable=True)
    client_ville = Column(String(255), nullable=True)
    
    # RDV
    date_rdv = Column(DateTime, nullable=False, index=True)
    heure_rdv = Column(String(20), nullable=True)
    duree_estimee = Column(Integer, nullable=True)  # minutes
    
    # Détails travaux
    description_travaux = Column(Text, nullable=True)
    montant_devis_ht = Column(Integer, nullable=True)  # en centimes
    montant_devis_ttc = Column(Integer, nullable=True)  # en centimes
    logement_plus_2_ans = Column(String(1), default="Y", nullable=False)  # Y/N
    
    # État
    status = Column(SQLEnum(InterventionStatus), default=InterventionStatus.PENDING, nullable=False, index=True)
    signature_token = Column(String(255), unique=True, nullable=True, index=True)
    signature_link_expires_at = Column(DateTime, nullable=True)
    
    # Tracking
    sms_sent_count = Column(Integer, default=0, nullable=False)
    last_sms_sent_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relations
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user = relationship("User", backref="interventions")
    documents = relationship("Document", back_populates="intervention", cascade="all, delete-orphan")
    signatures = relationship("Signature", back_populates="intervention", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Intervention {self.client_nom} {self.client_prenom} - {self.date_rdv.strftime('%d/%m/%Y') if self.date_rdv else 'no date'}>"
