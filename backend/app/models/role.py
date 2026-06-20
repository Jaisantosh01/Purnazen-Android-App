import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False, unique=True)
    icon = Column(String(50))
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"))
    updated_by = Column(GUID(), ForeignKey("users.id"))

    def to_dict(self):
        return {
            "id": str(self.id),
            "name": self.name,
            "icon": self.icon,
            "is_default": self.is_default,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
