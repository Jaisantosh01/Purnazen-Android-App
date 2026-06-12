from sqlalchemy import Column, ForeignKey, Integer, String, Text

from app.db.base_class import Base


class Award(Base):
    __tablename__ = "awards"

    id = Column(Integer, primary_key=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    title = Column(String(255), nullable=False)
    issuer = Column(String(255))
    year = Column(Integer)
    description = Column(Text)

    def to_dict(self):
        return {
            "id": self.id,
            "doctor_id": self.doctor_id,
            "title": self.title,
            "issuer": self.issuer,
            "year": self.year,
            "description": self.description,
        }
