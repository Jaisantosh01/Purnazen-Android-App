from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.db.base_class import Base




class Language(Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}
