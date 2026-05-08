"""Modele pour les notifications systeme (admin dashboard)."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from database import Base


class NotificationType(str, enum.Enum):
    """Types d'evenements qui peuvent generer une notification."""
    SIGNATURE_RECEIVED = "signature_received"      # Une signature client est arrivee
    SIGNATURE_COMPLETE = "signature_complete"      # Tous les docs sont signes
    SMS_DELIVERED = "sms_delivered"                # SMS livre avec succes
    SMS_FAILED = "sms_failed"                      # SMS echoue
    EMAIL_SENT = "email_sent"                      # Email PDF envoye au client
    EMAIL_FAILED = "email_failed"                  # Email PDF a echoue
    CALENDAR_SYNC_SUCCESS = "calendar_sync_success"  # Sync Calendar OK avec ajouts
    CALENDAR_SYNC_ERROR = "calendar_sync_error"    # Sync Calendar a foire
    INTERVENTION_EXPIRED = "intervention_expired"  # Lien signature expire
    INTERVENTION_CREATED = "intervention_created"  # Nouvelle intervention creee (manuel ou Calendar)
    SYSTEM_ERROR = "system_error"                  # Erreur systeme generique


class NotificationSeverity(str, enum.Enum):
    """Niveau de gravite d'une notification."""
    INFO = "info"            # Bleu, neutre
    SUCCESS = "success"      # Vert, ok
    WARNING = "warning"      # Orange, attention
    CRITICAL = "critical"    # Rouge, action requise (mail admin)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False, default="info", index=True)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # Lien optionnel pour rediriger l'admin (ex: vers une intervention)
    link_url = Column(String(500), nullable=True)

    # Lien optionnel a une intervention
    intervention_id = Column(UUID(as_uuid=True), ForeignKey("interventions.id", ondelete="SET NULL"), nullable=True, index=True)

    # Etat de lecture
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)

    # Mail admin envoye ?
    email_sent = Column(Boolean, default=False, nullable=False)
    email_sent_at = Column(DateTime, nullable=True)

    # Metadata libre (ex: id du SMS qui a echoue, count de la sync, etc.)
    metadata_json = Column(JSONB, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relation
    intervention = relationship("Intervention", foreign_keys=[intervention_id])
