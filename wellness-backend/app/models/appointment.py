from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Time,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base_class import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    consultation_type_id = Column(Integer, ForeignKey("consultation_types.id"))
    visit_type = Column(String(20), nullable=False)
    date = Column(Date, nullable=False)
    slot_start = Column(Time, nullable=False)
    slot_end = Column(Time, nullable=False)
    fee = Column(Numeric(10, 2))
    status = Column(String(20), nullable=False, default="booked")  # booked | cancelled | completed
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", backref="appointments")
    doctor = relationship("Doctor", backref="appointments")
    consultation_type = relationship("ConsultationType")

    __table_args__ = (Index("ix_appointments_doctor_date", "doctor_id", "date"),)

    @property
    def reference(self):
        return f"APT-{self.id:06d}"

    def to_dict(self):
        return {
            "id": self.id,
            "reference": self.reference,
            "doctorId": str(self.doctor_id),
            "doctorName": f"Dr. {self.doctor.user.full_name}",
            "specialty": self.doctor.specialty.name,
            "visitType": self.visit_type,
            "date": self.date.isoformat(),
            "time": self.slot_start.strftime("%I:%M %p"),
            "slotStart": self.slot_start.strftime("%H:%M"),
            "slotEnd": self.slot_end.strftime("%H:%M"),
            "fee": float(self.fee) if self.fee is not None else None,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }
