from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.db.base_class import Base


class Specialty(Base):
    __tablename__ = "specialties"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
