from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class UserPreference(Base):
    """Per-user notification preferences: a master switch plus a dict of
    granular toggle keys (the apps' toggle ids, e.g. "session_reminder",
    "appointment", "offers") — JSON so new toggles don't need migrations."""

    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    push_enabled = Column(Boolean, nullable=False, default=True)
    notifications = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="preferences")

    def to_dict(self):
        return {
            "pushEnabled": self.push_enabled,
            "notifications": self.notifications or {},
        }
