import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.models.role import Role


ALLOWED_CONTENT_TYPES = {"terms", "privacy", "faq"}


class ContentPage(Base):
    __tablename__ = "content_pages"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    type = Column(String(20), nullable=False)
    role_id = Column(GUID(), ForeignKey("roles.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(String(20), nullable=False, default="1.0")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"))
    updated_by = Column(GUID(), ForeignKey("users.id"))

    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    role = relationship("Role")

    def to_dict(self):
        return {
            "id": str(self.id),
            "type": self.type,
            "roleId": str(self.role_id),
            "roleName": self.role.name if self.role else None,
            "title": self.title,
            "content": self.content,
            "version": self.version,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
