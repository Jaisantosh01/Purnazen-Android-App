from sqlalchemy import Column, Integer, String

from app.db.base_class import Base


class ConsultationType(Base):
    __tablename__ = "consultation_types"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}
