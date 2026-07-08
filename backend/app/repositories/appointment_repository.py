import uuid

from datetime import date as date_type
from datetime import time as time_type
from typing import Optional

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
        from app.models.doctor import Doctor
        from app.models.user import User
        from app.models.specialty import Specialty
        from app.models.doctor_expertise_mapping import DoctorExpertiseMapping
        from app.models.expertise import Expertise
        from app.models.clinic import Clinic
        from app.models.user_address import UserAddress

        return (
            db.query(Appointment)
            .join(SlotTimings, Appointment.slot_timing_id == SlotTimings.id)
            .options(
                joinedload(Appointment.slot_timing),
                joinedload(Appointment.doctor)
                .joinedload(Doctor.user),
                joinedload(Appointment.doctor)
                .joinedload(Doctor.specialty),
                joinedload(Appointment.doctor)
                .joinedload(Doctor.expertise_mappings)
                .joinedload(DoctorExpertiseMapping.expertise),
                joinedload(Appointment.clinic),
                joinedload(Appointment.user_address),
            )
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

    @staticmethod
    def get_doctor_appointments(
        db: Session,
        doctor_id: uuid.UUID,
        date: Optional[date_type] = None,
        status: Optional[str] = None,
    ) -> list[Appointment]:
        query = (
            db.query(Appointment)
            .join(SlotTimings, Appointment.slot_timing_id == SlotTimings.id)
            .options(
                joinedload(Appointment.user),
                joinedload(Appointment.slot_timing),
                joinedload(Appointment.consultation_type),
            )
            .filter(Appointment.doctor_id == doctor_id)
        )

        if date is not None:
            query = query.filter(Appointment.date == date)

        if status is not None:
            query = query.filter(Appointment.status == status)

        return (
            query
            .order_by(Appointment.date.desc(), SlotTimings.start_time.asc())
            .all()
        )

    @staticmethod
    def count_previous_visits(
        db: Session,
        user_id: uuid.UUID,
        doctor_id: uuid.UUID,
        before_date: date_type,
    ) -> int:
        """Count completed appointments for the same patient+doctor before a date."""
        return (
            db.query(Appointment)
            .filter(
                Appointment.user_id == user_id,
                Appointment.doctor_id == doctor_id,
                Appointment.status == "completed",
                Appointment.date < before_date,
            )
            .count()
        )

