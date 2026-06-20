from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base
from app.models.videos import Videos # Import
from app.models.user import User # Import

class VideoGroupMapping(Base):
    __tablename__ = "video_group_mappings"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    video_group_id = Column(GUID(), ForeignKey("video_groups.id"), nullable=False)
    video_id = Column(GUID(), ForeignKey("videos.id"), nullable=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=False)

    video_group = relationship("VideoGroups", back_populates="video_mappings")
    video = relationship("Videos", back_populates="group_mappings")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])

    def to_dict(self):
        return {
            "id": self.id,
            "videoGroupId": self.video_group_id,
            "videoId": self.video_id,
            "sortOrder": self.sort_order,
            "isActive": self.is_active,
            "createdBy": self.created_by,
            "updatedBy": self.updated_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
