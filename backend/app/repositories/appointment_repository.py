from datetime import date as date_type
from datetime import time as time_type

from sqlalchemy.orm import Session

from app.models.appointment import Appointment


class AppointmentRepository:

    @staticmethod
    def create(db: Session, **fields) -> Appointment:
        appointment = Appointment(**fields)
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        return appointment

    @staticmethod
    def get_user_appointments(db: Session, user_id: int) -> list[Appointment]:
        return (
            db.query(Appointment)
            .filter(Appointment.user_id == user_id)
            .order_by(Appointment.date.desc(), Appointment.slot_start.desc())
            .all()
        )

    @staticmethod
    def slot_taken(
        db: Session, doctor_id: int, date: date_type, slot_start: time_type
    ) -> bool:
        return (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor_id,
                Appointment.date == date,
                Appointment.slot_start == slot_start,
                Appointment.status != "cancelled",
            )
            .first()
            is not None
        )

    @staticmethod
    def get_booked_slot_starts(
        db: Session, doctor_id: int, date: date_type
    ) -> set[time_type]:
        rows = (
            db.query(Appointment.slot_start)
            .filter(
                Appointment.doctor_id == doctor_id,
                Appointment.date == date,
                Appointment.status != "cancelled",
            )
            .all()
        )
        return {row[0] for row in rows}
