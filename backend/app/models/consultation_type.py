from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.db.base_class import Base


class ConsultationType(Base):
    __tablename__ = "consultation_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(Integer, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(Integer, nullable=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}
