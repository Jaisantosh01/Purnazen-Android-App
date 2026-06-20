from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base


class UserPreference(Base):
    """Per-user notification preferences: a master switch plus a dict of
    granular toggle keys (the apps' toggle ids, e.g. "session_reminder",
    "appointment", "offers") — JSON so new toggles don't need migrations."""

    __tablename__ = "user_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    push_enabled = Column(Boolean, nullable=False, default=True)
    notifications = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", foreign_keys=[user_id], backref="preferences")
    
    def to_dict(self):
        return {
            "pushEnabled": self.push_enabled,
            "notifications": self.notifications or {},
        }
