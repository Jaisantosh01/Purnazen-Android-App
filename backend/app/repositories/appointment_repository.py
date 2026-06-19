import uuid

from datetime import date as date_type
from datetime import time as time_type

from sqlalchemy.orm import Session, joinedload

from app.models.appointment import Appointment
from app.models.slot_timings import SlotTimings


class AppointmentRepository:

    @staticmethod
    def create(db: Session, **fields) -> Appointment:
        appointment = Appointment(**fields)
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        return appointment

    @staticmethod
    def get_user_appointments(db: Session, user_id: uuid.UUID) -> list[Appointment]:
        return (
            db.query(Appointment)
            .join(SlotTimings, Appointment.slot_timing_id == SlotTimings.id)
            .filter(Appointment.user_id == user_id)
            .order_by(Appointment.date.desc(), SlotTimings.start_time.desc())
            .all()
        )

    @staticmethod
    def slot_taken(
        db: Session, doctor_id: uuid.UUID, date: date_type, slot_timing_id: uuid.UUID
    ) -> bool:
        return (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor_id,
                Appointment.date == date,
                Appointment.slot_timing_id == slot_timing_id,
                Appointment.status.in_(["booked", "pending"]),
            )
            .first()
            is not None
        )

    @staticmethod
    def get_booked_slot_ids(
        db: Session, doctor_id: uuid.UUID, date: date_type
    ) -> set[uuid.UUID]:
        rows = (
            db.query(Appointment.slot_timing_id)
            .filter(
                Appointment.doctor_id == doctor_id,
                Appointment.date == date,
                Appointment.status != "cancelled",
            )
            .all()
        )
        return {row[0] for row in rows}

    @staticmethod
    def get_booked_slot_starts(
        db: Session, doctor_id: uuid.UUID, date: date_type
    ) -> set[time_type]:
        rows = (
            db.query(SlotTimings.start_time)
            .join(Appointment, Appointment.slot_timing_id == SlotTimings.id)
            .filter(
                Appointment.doctor_id == doctor_id,
                Appointment.date == date,
                Appointment.status != "cancelled",
            )
            .all()
        )
        return {row[0] for row in rows}
