"""SmsLog model — historique des SMS envoyés via Twilio (audit trail)."""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from database import Base


class SmsType(str, enum.Enum):
    SIGNATURE_INITIAL = "signature_initial"
    SIGNATURE_RELANCE = "signature_relance"
    RDV_RAPPEL = "rdv_rappel"
    AUTRE = "autre"


class SmsStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    UNDELIVERED = "undelivered"


class SmsLog(Base):
    __tablename__ = "sms_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Lien optionnel vers une intervention (peut être null pour SMS hors workflow)
    intervention_id = Column(
        UUID(as_uuid=True),
        ForeignKey("interventions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Métadonnées du SMS
    phone = Column(String(20), nullable=False, index=True)
    message = Column(Text, nullable=False)
    sms_type = Column(SQLEnum(SmsType), default=SmsType.SIGNATURE_INITIAL, nullable=False, index=True)
    status = Column(SQLEnum(SmsStatus), default=SmsStatus.PENDING, nullable=False, index=True)

    # Twilio
    twilio_sid = Column(String(64), nullable=True, index=True)
    twilio_response = Column(JSONB, nullable=True)  # Réponse complète pour debug
    error_message = Column(Text, nullable=True)

    # Timestamps
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    delivered_at = Column(DateTime, nullable=True)

    # Relations
    intervention = relationship("Intervention", back_populates="sms_logs")
