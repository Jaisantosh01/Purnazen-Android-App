from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base


class TherapySession(Base):
    __tablename__ = "therapy_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("video_groups.id"), nullable=False)
    video_id = Column(UUID(as_uuid=True), ForeignKey("videos.id"), nullable=False)
    session_type = Column(String(30), nullable=False)  # wellness | relief | yoga | ...
    duration_minutes = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="Completed")
    pain_before = Column(Integer)
    pain_after = Column(Integer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), name="updated_at")
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, name="updated_by")

    user = relationship("User", foreign_keys=[user_id], backref="therapy_sessions")
    creator = relationship("User", foreign_keys=[created_by])
    modifier = relationship("User", foreign_keys=[updated_by])
    video_group = relationship("VideoGroups")
    video = relationship("Videos")

    __table_args__ = (
        Index("ix_therapy_sessions_user_group_video", "user_id", "group_id", "video_id"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "userId": self.user_id,
            "groupId": self.group_id,
            "videoId": self.video_id,
            "groupTitle": self.video_group.title if self.video_group else None,
            "videoTitle": self.video.title if self.video else None,
            "type": self.session_type,
            "duration": f"{self.duration_minutes} min",
            "status": self.status,
            "painBefore": self.pain_before,
            "painAfter": self.pain_after,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
