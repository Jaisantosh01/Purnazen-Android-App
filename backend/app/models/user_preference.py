from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class UserPreference(Base):
    """Per-user notification preferences: a master switch plus a dict of
    granular toggle keys (the apps' toggle ids, e.g. "session_reminder",
    "appointment", "offers") — JSON so new toggles don't need migrations."""

    __tablename__ = "user_preferences"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, unique=True)
    push_enabled = Column(Boolean, nullable=False, default=True)
    notifications = Column(JSON, nullable=False, default=dict)
    language = Column(String(10), nullable=False, server_default="en", default="en")
    address = Column(String(255), nullable=True)
    location_enabled = Column(
        Boolean, nullable=False, server_default="false", default=False
    )
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", foreign_keys=[user_id], backref="preferences")
    
    def to_dict(self):
        return {
            "pushEnabled": self.push_enabled,
            "notifications": self.notifications or {},
            "language": self.language or "en",
            "address": self.address,
            "locationEnabled": bool(self.location_enabled),
        }
