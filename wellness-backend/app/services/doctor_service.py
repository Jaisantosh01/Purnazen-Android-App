from datetime import date as date_type
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.doctor_repository import DoctorRepository

# Presentation metadata for the BookAppointmentScreen visit-type cards,
# keyed by the consultation_types.name lookup values.
VISIT_TYPE_PRESENTATION = {
    "Video Call": {
        "id": "video",
        "title": "Video Consultation",
        "subtitle": "Consult from anywhere",
        "icon": "📹",
    },
    "Home Visit": {
        "id": "home",
        "title": "Home Visit",
        "subtitle": "Doctor visits your home",
        "icon": "🏠",
    },
    "Clinic Visit": {
        "id": "clinic",
        "title": "Clinic Visit",
        "subtitle": "Meet at the clinic",
        "icon": "🏥",
    },
}

# Reverse map: frontend visit-type slug -> consultation_types.name
VISIT_SLUG_TO_CONSULTATION_TYPE = {
    meta["id"]: name for name, meta in VISIT_TYPE_PRESENTATION.items()
}


class DoctorService:

    @staticmethod
    def get_doctors(
        db: Session, page: int, limit: int, search: str, filter_key: str | None = None
    ):
        return DoctorRepository.get_doctors(db, page, limit, search, filter_key)

    @staticmethod
    def get_doctor_by_id(db: Session, doctor_id: int) -> Doctor | None:
        return DoctorRepository.get_by_id(db, doctor_id)

    @staticmethod
    def get_visit_types(doctor: Doctor) -> list[dict]:
        fee = float(doctor.consultation_fee)
        visit_types = []
        for consultation_type in doctor.consultation_types:
            meta = VISIT_TYPE_PRESENTATION.get(
                consultation_type.name,
                {
                    "id": consultation_type.name.lower().replace(" ", "-"),
                    "title": consultation_type.name,
                    "subtitle": "",
                    "icon": "🩺",
                },
            )
            visit_types.append(
                {**meta, "fee": fee, "consultationTypeId": consultation_type.id}
            )
        return visit_types

    @staticmethod
    def get_time_slots(db: Session, doctor: Doctor, on_date: date_type) -> list[str]:
        """Generate bookable slots from the weekly availability, minus booked ones."""
        day_name = on_date.strftime("%A").lower()
        booked = AppointmentRepository.get_booked_slot_starts(db, doctor.id, on_date)

        slots = []
        for availability in doctor.availabilities:
            if not availability.is_available:
                continue
            if (availability.day_of_week or "").lower() != day_name:
                continue

            step = timedelta(minutes=availability.slot_duration_minutes or 30)
            current = datetime.combine(on_date, availability.start_time)
            end = datetime.combine(on_date, availability.end_time)
            while current + step <= end:
                if current.time() not in booked:
                    slots.append(current.time())
                current += step

        return [slot.strftime("%I:%M %p") for slot in sorted(set(slots))]

    @staticmethod
    def get_slot_duration_minutes(doctor: Doctor, on_date: date_type, slot_start) -> int:
        """Duration of the availability window covering the slot (default 30)."""
        day_name = on_date.strftime("%A").lower()
        for availability in doctor.availabilities:
            if (
                availability.is_available
                and (availability.day_of_week or "").lower() == day_name
                and availability.start_time <= slot_start < availability.end_time
            ):
                return availability.slot_duration_minutes or 30
        return 30
