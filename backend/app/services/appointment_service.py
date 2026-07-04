from datetime import date, datetime
from typing import Optional


import uuid

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.consultation_type import ConsultationType
from app.models.user import User
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.doctor_repository import DoctorRepository
from app.schemas.appointment import BookAppointmentRequest, UpdateAppointmentRequest
from app.services.doctor_service import (
    VISIT_SLUG_TO_CONSULTATION_TYPE,
)


class AppointmentService:

    @staticmethod
    def book(db: Session, user: User, data: BookAppointmentRequest):
        doctor = DoctorRepository.get_by_id(db, data.doctor_id)
        if not doctor:
            return {"success": False, "message": "Doctor not found"}, 404

        if data.date < date.today():
            return {"success": False, "message": "Date must not be in the past"}, 400

        if AppointmentRepository.slot_taken(db, doctor.id, data.date, data.slot_timing_id):
            return {
                "success": False,
                "message": "This time slot is already booked. Please pick another one.",
            }, 409

        consultation_type_name = VISIT_SLUG_TO_CONSULTATION_TYPE.get(data.visit_type)
        consultation_type = (
            db.query(ConsultationType).filter_by(name=consultation_type_name).first()
            if consultation_type_name
            else None
        )

        appointment = AppointmentRepository.create(
            db,
            user_id=user.id,
            doctor_id=doctor.id,
            consultation_type_id=consultation_type.id if consultation_type else None,
            visit_type=data.visit_type,
            date=data.date,
            slot_timing_id=data.slot_timing_id,
            clinic_id=data.clinic_id,
            user_address_id=data.user_address_id,
            fee=data.fee if data.fee is not None else float(doctor.consultation_fee),
            status="pending",
            payment_status="pending",
            user_description=data.user_description,
            created_by=user.id,
        )

        return {
            "success": True,
            "message": "Appointment booked successfully",
            "appointment": appointment.to_dict(),
        }, 201

    @staticmethod
    def update(db: Session, user: User, appointment_id: uuid.UUID, data: UpdateAppointmentRequest):
        appointment = db.get(Appointment, appointment_id)
        if not appointment:
            return None

        if data.visit_type:
            appointment.visit_type = data.visit_type
        if data.date:
            appointment.date = data.date
        if data.slot_timing_id:
            appointment.slot_timing_id = data.slot_timing_id
        if data.status:
            appointment.status = data.status
        if data.payment_status:
            appointment.payment_status = data.payment_status
            
        appointment.updated_at = datetime.utcnow()
        appointment.updated_by = user.id
        db.commit()
        db.refresh(appointment)
        return appointment

    @staticmethod
    def get_user_appointments(db: Session, user_id: uuid.UUID) -> dict:
        appointments = AppointmentRepository.get_user_appointments(db, user_id)
        today = date.today()

        serialized = []
        for appointment in appointments:
            item = appointment.to_dict()
            item["isUpcoming"] = (
                appointment.status == "pending" and appointment.date >= today
            )
            serialized.append(item)

        return {"appointments": serialized, "total": len(serialized)}

    @staticmethod
    def get_doctor_appointments(
        db: Session,
        user: "User",
        filter_date: Optional[date] = None,
        filter_status: Optional[str] = None,
    ) -> dict:
        from app.models.doctor import Doctor

        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor:
            return None  # caller converts to 404

        appointments = AppointmentRepository.get_doctor_appointments(
            db,
            doctor_id=doctor.id,
            date=filter_date,
            status=filter_status,
        )

        serialized = []
        for a in appointments:
            item = a.to_dict()

            # Enrich with patient profile fields
            if a.user:
                item["userEmail"] = a.user.email
                item["userPhone"] = a.user.phone
                item["userGender"] = a.user.gender
                item["userAge"] = a.user.age
            else:
                item["userEmail"] = None
                item["userPhone"] = None
                item["userGender"] = None
                item["userAge"] = None

            # Previous visits count (completed appointments before this one)
            item["previousVisitsCount"] = AppointmentRepository.count_previous_visits(
                db,
                user_id=a.user_id,
                doctor_id=a.doctor_id,
                before_date=a.date,
            )

            serialized.append(item)

        return {"appointments": serialized, "total": len(serialized)}

