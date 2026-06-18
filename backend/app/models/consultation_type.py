from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base_class import Base


class ConsultationType(Base):
    __tablename__ = "consultation_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String(50), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}
