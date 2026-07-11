import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.types import GUID


class Broadcast(Base):
    """An admin broadcast (sent or scheduled) to an audience of users.

    One row per composed broadcast — the per-recipient fan-out lives in the
    ``notifications`` table. Keeping the composed message lets admins review
    recent broadcasts, duplicate one to resend, and schedule future sends
    (dispatched by the reminder scheduler loop).

    ``segment`` narrows the audience for personalized offers:
      everyone | new_users (joined ≤30 days) | inactive_users (no appointment
      in 60 days). ``{name}`` in title/body is replaced per recipient.
    """

    __tablename__ = "broadcasts"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    audience = Column(String(20), nullable=False, default="all")  # all | users | doctors
    segment = Column(String(30), nullable=False, default="everyone", server_default="everyone")
    category = Column(String(20), nullable=False, default="promo")  # promo | system
    status = Column(String(20), nullable=False, default="sent")  # scheduled | sent | cancelled
    scheduled_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    recipients_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    creator = relationship("User", foreign_keys=[created_by])

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "body": self.body,
            "audience": self.audience,
            "segment": self.segment,
            "category": self.category,
            "status": self.status,
            "scheduledAt": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "sentAt": self.sent_at.isoformat() if self.sent_at else None,
            "recipients": self.recipients_count,
            "createdBy": str(self.created_by) if self.created_by else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
