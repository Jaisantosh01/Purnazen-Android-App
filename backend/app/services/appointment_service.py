from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.consultation_type import ConsultationType
from app.models.user import User
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.doctor_repository import DoctorRepository
from app.schemas.appointment import BookAppointmentRequest
from app.services.doctor_service import (
    DoctorService,
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

        try:
            slot_start = datetime.strptime(data.time.strip(), "%I:%M %p").time()
        except ValueError:
            return {
                "success": False,
                "message": "Invalid time. Use the HH:MM AM/PM format.",
            }, 400

        if AppointmentRepository.slot_taken(db, doctor.id, data.date, slot_start):
            return {
                "success": False,
                "message": "This time slot is already booked. Please pick another one.",
            }, 409

        duration = DoctorService.get_slot_duration_minutes(doctor, data.date, slot_start)
        slot_end = (
            datetime.combine(data.date, slot_start) + timedelta(minutes=duration)
        ).time()

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
            slot_start=slot_start,
            slot_end=slot_end,
            fee=data.fee if data.fee is not None else doctor.consultation_fee,
            status="booked",
        )

        return {
            "success": True,
            "message": "Appointment booked successfully",
            "appointment": appointment.to_dict(),
        }, 201

    @staticmethod
    def get_user_appointments(db: Session, user_id: int) -> dict:
        appointments = AppointmentRepository.get_user_appointments(db, user_id)
        today = date.today()

        serialized = []
        for appointment in appointments:
            item = appointment.to_dict()
            item["isUpcoming"] = (
                appointment.status == "booked" and appointment.date >= today
            )
            serialized.append(item)

        return {"appointments": serialized, "total": len(serialized)}
