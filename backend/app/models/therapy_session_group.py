from sqlalchemy import Column, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class TherapySessionGroup(Base):
    __tablename__ = "therapy_session_groups"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    group_id = Column(GUID(), ForeignKey("video_groups.id"), nullable=False)
    session_type = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="in_progress")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id], backref="therapy_session_groups")
    video_group = relationship("VideoGroups")

    __table_args__ = (
        Index("ix_therapy_session_groups_user_group", "user_id", "group_id", "session_type"),
    )

    def to_dict(self):
        return {
            "id": str(self.id),
            "userId": str(self.user_id),
            "groupId": str(self.group_id),
            "sessionType": self.session_type,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
