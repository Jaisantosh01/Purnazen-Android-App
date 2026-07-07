import uuid

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.types import GUID


class Notification(Base):
    """A single in-app notification for one recipient.

    ``category`` gates delivery against user preferences and the global admin
    switches; ``event`` is the machine-readable trigger (used by the apps for
    icons/deep-links); ``data`` carries context ids (appointmentId, ...).
    """

    __tablename__ = "notifications"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    category = Column(String(20), nullable=False)  # appointment | payment | promo | reminder | system
    event = Column(String(40), nullable=False)
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    data = Column(JSON, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])

    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    def to_dict(self):
        return {
            "id": str(self.id),
            "category": self.category,
            "event": self.event,
            "title": self.title,
            "body": self.body,
            "data": self.data or {},
            "isRead": bool(self.is_read),
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
