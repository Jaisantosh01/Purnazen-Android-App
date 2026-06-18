from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    full_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500))
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="patient")
    # Bumped on password change; tokens carry it as "ver" and older ones are rejected
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.email}>"
