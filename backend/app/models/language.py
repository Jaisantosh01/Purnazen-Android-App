from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from app.db.types import GUID
import uuid

from app.db.base_class import Base




class Language(Base):
    __tablename__ = "languages"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    name = Column(String(50), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
      return {"id": str(self.id),"name": self.name}
