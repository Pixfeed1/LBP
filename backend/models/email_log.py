"""Modele pour tracer les emails envoyes."""
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

from database import Base


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intervention_id = Column(UUID(as_uuid=True), ForeignKey("interventions.id", ondelete="CASCADE"), nullable=True, index=True)
    recipient = Column(String(255), nullable=False, index=True)
    subject = Column(Text, nullable=False)
    status = Column(String(50), default="pending", nullable=False)  # pending / sent / failed
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
