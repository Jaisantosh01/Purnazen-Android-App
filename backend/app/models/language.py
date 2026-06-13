from sqlalchemy import Column, Integer, String

from app.db.base_class import Base


class Language(Base):
    __tablename__ = "languages"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name}
