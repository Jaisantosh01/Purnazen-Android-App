from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, JSON, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base
from app.models.video_groups import VideoGroups  # Import explicitly

class WellnessSession(Base):
    """Wellness player content (yoga/meditation/breathing), keyed by the
    frontend sessionKey (e.g. "YogaSession") — mirrors src/data/yogaSessionData.js."""

    __tablename__ = "wellness_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    title = Column(String(150), nullable=False)
    duration = Column(String(30), nullable=False)
    icon = Column(String(20))
    video_group_id = Column(UUID(as_uuid=True), ForeignKey("video_groups.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    video_group = relationship("VideoGroups")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "duration": self.duration,
            "icon": self.icon,
            "videoGroupId": self.video_group_id,
            "sortOrder": self.sort_order,
            "isActive": self.is_active,
        }
