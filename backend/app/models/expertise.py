from sqlalchemy import Column, Integer, String

from app.db.base_class import Base


class Expertise(Base):
    __tablename__ = "expertise"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}
