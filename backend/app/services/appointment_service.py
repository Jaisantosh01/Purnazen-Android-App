from datetime import date, datetime, time as time_type
from typing import Optional


import uuid

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.consultation_type import ConsultationType
from app.models.user import User
from app.models.slot_timings import SlotTimings
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.doctor_repository import DoctorRepository
from app.schemas.appointment import BookAppointmentRequest, UpdateAppointmentRequest
from app.utils.names import format_doctor_name
from app.services.doctor_service import (
    VISIT_SLUG_TO_CONSULTATION_TYPE,
)
from app.services.notification_service import NotificationService
from app.services.tax_service import TaxService

# Google Meet integration — gracefully skipped when the service is unavailable
try:
    from app.services.google_meet_service import create_meet_link as _create_meet_link
except ImportError:
    _create_meet_link = None


class AppointmentService:

    @staticmethod
    def book(db: Session, user: User, data: BookAppointmentRequest):
        doctor = DoctorRepository.get_by_id(db, data.doctor_id)
        if not doctor:
            return {"success": False, "message": "Doctor not found"}, 404

        if data.date < date.today():
            return {"success": False, "message": "Date must not be in the past"}, 400

        # If the user already has their own unpaid hold on this exact slot (e.g.
        # they booked earlier but never paid), resume it instead of reporting the
        # slot as taken or creating a duplicate — the hold only becomes a real
        # block once payment is confirmed.
        existing_hold = AppointmentRepository.get_user_unpaid_hold(
            db, user.id, doctor.id, data.date, data.slot_timing_id
        )
        if existing_hold is not None:
            return {
                "success": True,
                "message": "Appointment booked successfully",
                "appointment": existing_hold.to_dict(),
            }, 200

        if AppointmentRepository.slot_taken(
            db, doctor.id, data.date, data.slot_timing_id, exclude_user_id=user.id
        ):
            return {
                "success": False,
                "message": "This time slot is already booked. Please pick another one.",
            }, 409

        # Verify that slot is not blocked by approved leave or not in doctor's configured availability
        from app.services.doctor_service import DoctorService
        available_slots = DoctorService.get_time_slots(db, doctor, data.date)
        available_slot_ids = {s["id"] for s in available_slots}
        if str(data.slot_timing_id) not in available_slot_ids:
            return {
                "success": False,
                "message": "Doctor is not available or on leave during this slot.",
            }, 409

        consultation_type_name = VISIT_SLUG_TO_CONSULTATION_TYPE.get(data.visit_type)
        consultation_type = (
            db.query(ConsultationType).filter_by(name=consultation_type_name).first()
            if consultation_type_name
            else None
        )

        fee = data.fee if data.fee is not None else float(doctor.consultation_fee)
        # Snapshot the GST rate in force right now. Everything downstream (the
        # confirmation screen, checkout, the receipt) reads it back off the row,
        # so a later change to the admin rate cannot alter this booking's total.
        gst_percentage = TaxService.gst_percentage(db)
        gst_amount = TaxService.gst_amount(fee, gst_percentage)

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
            fee=fee,
            gst_percentage=gst_percentage,
            gst_amount=gst_amount,
            status="pending",
            payment_status="pending",
            user_description=data.user_description,
            created_by=user.id,
        )

        # Generate Google Meet link for video consultations
        if data.visit_type == "video" and _create_meet_link is not None:
            slot_timing = db.get(SlotTimings, data.slot_timing_id)
            if slot_timing and slot_timing.start_time:
                start_dt = datetime.combine(data.date, slot_timing.start_time)
                end_dt = datetime.combine(
                    data.date,
                    slot_timing.end_time or time_type(
                        slot_timing.start_time.hour + 1,
                        slot_timing.start_time.minute,
                    ),
                )
                doctor_name = format_doctor_name(doctor.user.full_name) if doctor.user else "Doctor"
                patient_name = user.full_name or "Patient"
                link = _create_meet_link(
                    summary=f"Consultation — {doctor_name} & {patient_name}",
                    description=(
                        f"Video consultation with {doctor_name}.\n"
                        f"Patient: {patient_name}\n"
                        f"Appointment reference: {appointment.reference}"
                    ),
                    start_dt=start_dt,
                    end_dt=end_dt,
                )
                if link:
                    appointment.meeting_link = link
                    db.commit()

        # Notify the doctor about the new booking request
        slot = db.get(SlotTimings, data.slot_timing_id)
        slot_str = slot.start_time.strftime("%I:%M %p") if slot and slot.start_time else ""
        NotificationService.notify_safely(
            db,
            doctor.user_id,
            category="appointment",
            event="appointment_booked",
            title="New appointment request",
            body=(
                f"{user.full_name or 'A patient'} booked {appointment.reference} "
                f"on {data.date.strftime('%d %b %Y')} at {slot_str}".strip()
            ),
            data={"appointmentId": str(appointment.id)},
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

        old_status = appointment.status
        old_payment_status = appointment.payment_status

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

        AppointmentService._notify_transitions(
            db, appointment, actor=user,
            old_status=old_status, old_payment_status=old_payment_status,
        )
        return appointment

    @staticmethod
    def _notify_transitions(db, appointment, actor, old_status, old_payment_status):
        """Fan out notifications for status / payment transitions.

        The actor (whoever performed the change) is not notified; the other
        parties are. Best-effort — never raises.
        """
        doctor_user_id = appointment.doctor.user_id if appointment.doctor else None
        patient_id = appointment.user_id
        ref = appointment.reference
        when = f"{appointment.date.strftime('%d %b %Y')}"
        doctor_name = (
            f"Dr. {appointment.doctor.user.full_name}"
            if appointment.doctor and appointment.doctor.user
            else "Your doctor"
        )
        patient_name = appointment.user.full_name if appointment.user else "The patient"

        transitions = {
            "booked": (
                "Appointment confirmed",
                f"{doctor_name} accepted {ref} on {when}.",
            ),
            "cancelled": (
                "Appointment cancelled",
                f"{ref} on {when} has been cancelled.",
            ),
            "completed": (
                "Appointment completed",
                f"{ref} with {doctor_name} is complete. We'd love your feedback!",
            ),
        }

        new_status = appointment.status
        if new_status != old_status and new_status in transitions:
            title, body = transitions[new_status]
            payload = {"appointmentId": str(appointment.id)}
            event = f"appointment_{new_status}"
            # Patient hears about everything they didn't do themselves
            if actor.id != patient_id:
                NotificationService.notify_safely(
                    db, patient_id, category="appointment", event=event,
                    title=title, body=body, data=payload,
                )
            # Doctor hears when the patient (or an admin) changed the state
            if doctor_user_id and actor.id != doctor_user_id:
                doc_body = (
                    f"{patient_name}'s {ref} on {when} is now {new_status}."
                )
                NotificationService.notify_safely(
                    db, doctor_user_id, category="appointment", event=event,
                    title=title, body=doc_body, data=payload,
                )

        new_payment = appointment.payment_status
        if new_payment != old_payment_status and new_payment == "paid":
            # The charged figure, not the pre-tax fee — this mirrors the receipt.
            fee = f"₹{appointment.total_amount}" if appointment.total_amount is not None else ""
            NotificationService.notify_safely(
                db, patient_id, category="payment", event="payment_paid",
                title="Payment received",
                body=f"Payment {fee} for {ref} was received successfully.".replace("  ", " "),
                data={"appointmentId": str(appointment.id)},
            )

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
    def serialize_for_doctor(db: Session, appointment: Appointment) -> dict:
        """Appointment as the doctor app needs it: the base dict plus the
        patient profile fields its cards render (age / gender / contact) and the
        prior-visit count.

        Both the doctor list endpoint and the single-appointment detail endpoint
        go through here. They used not to — detail returned the bare
        ``to_dict()`` — so opening an appointment from the list replaced the
        enriched row with an unenriched one and the patient's age and gender
        flipped to "N/A" a moment after the screen appeared.
        """
        item = appointment.to_dict()
        patient = appointment.user

        item["userEmail"] = patient.email if patient else None
        item["userPhone"] = patient.phone if patient else None
        item["userGender"] = patient.gender if patient else None
        item["userAge"] = patient.age if patient else None
        item["userDateOfBirth"] = (
            patient.date_of_birth.isoformat() if patient and patient.date_of_birth else None
        )

        # Previous visits count (completed appointments before this one)
        item["previousVisitsCount"] = AppointmentRepository.count_previous_visits(
            db,
            user_id=appointment.user_id,
            doctor_id=appointment.doctor_id,
            before_date=appointment.date,
        )
        return item

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

        serialized = [
            AppointmentService.serialize_for_doctor(db, a) for a in appointments
        ]

        return {"appointments": serialized, "total": len(serialized)}

