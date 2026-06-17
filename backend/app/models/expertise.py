from sqlalchemy import Column, Integer, String, func, DateTime, Boolean

from app.db.base_class import Base


class Expertise(Base):
    __tablename__ = "expertise"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}
