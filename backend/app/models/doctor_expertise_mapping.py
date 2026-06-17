from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, func

from app.db.base_class import Base


class DoctorExpertiseMapping(Base):
    __tablename__ = "doctor_expertise_mapping"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expertise_id = Column(Integer, ForeignKey("expertise.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    updated_by = Column(Integer, ForeignKey("users.id"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "expertise_id": self.expertise_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
