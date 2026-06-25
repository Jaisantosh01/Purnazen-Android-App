from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class Videos(Base):
    __tablename__ = "videos"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(String(500), nullable=False)
    duration = Column(Integer, nullable=True)
    icon = Column(String(20))
    video_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=False)

    group_mappings = relationship("VideoGroupMapping", back_populates="video", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "duration": self.duration,
            "icon": self.icon,
            "videoUrl": self.video_url,
            "isActive": self.is_active,
            "createdBy": self.created_by,
            "updatedBy": self.updated_by,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
