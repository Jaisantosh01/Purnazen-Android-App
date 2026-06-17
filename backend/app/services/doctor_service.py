from datetime import date as date_type
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.doctor_expertise_mapping import DoctorExpertiseMapping
from app.models.doctor_language_mapping import DoctorLanguageMapping
from app.models.doctor_speciality_mapping import DoctorSpecialityMapping
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
    def update(db: Session, doctor_id: int, data: dict, user):
        doctor = db.get(Doctor, doctor_id)
        if not doctor:
            return None
        
        # Update basic fields
        doctor.about = data.get("about", doctor.about)
        doctor.education = data.get("education", doctor.education)
        doctor.experience_years = data.get("experience_years", doctor.experience_years)
        doctor.consultation_fee = data.get("consultation_fee", doctor.consultation_fee)
        doctor.is_active = data.get("is_active", doctor.is_active)
        
        # Update mappings
        if "expertise_ids" in data:
            db.query(DoctorExpertiseMapping).filter_by(doctor_id=doctor.id).delete()
            for exp_id in data["expertise_ids"]:
                db.add(DoctorExpertiseMapping(doctor_id=doctor.id, expertise_id=exp_id, created_by=user.id))
        
        if "language_ids" in data:
            db.query(DoctorLanguageMapping).filter_by(doctor_id=doctor.id).delete()
            for lang_id in data["language_ids"]:
                db.add(DoctorLanguageMapping(doctor_id=doctor.id, language_id=lang_id, created_by=user.id))
        
        if "specialty_id" in data:
            doctor.specialty_id = data["specialty_id"]
        
        if "specialty_ids" in data:
            db.query(DoctorSpecialityMapping).filter_by(doctor_id=doctor.id).delete()
            for spec_id in data["specialty_ids"]:
                db.add(DoctorSpecialityMapping(doctor_id=doctor.id, speciality_id=spec_id, created_by=user.id))

        doctor.updated_at = datetime.utcnow()
        doctor.updated_by = user.id
        db.commit()
        db.refresh(doctor)
        return doctor

    @staticmethod
    def create(db: Session, data: dict, user):
        # Assuming data contains 'user_id' to link the doctor profile to
        if not data.get("user_id"):
            return None
            
        new_doctor = Doctor(
            user_id=data["user_id"],
            specialty_id=data.get("specialty_ids", [None])[0] if data.get("specialty_ids") else None,
            about=data.get("about", ""),
            education=data.get("education", ""),
            experience_years=data.get("experience", 0),
            consultation_fee=data.get("fee", 0),
            created_by=user.id
        )
        db.add(new_doctor)
        db.commit()
        db.refresh(new_doctor)
        
        # Initialize mappings
        if "expertise_ids" in data:
            for exp_id in data["expertise_ids"]:
                db.add(DoctorExpertiseMapping(doctor_id=new_doctor.id, expertise_id=exp_id, created_by=user.id))
        
        if "language_ids" in data:
            for lang_id in data["language_ids"]:
                db.add(DoctorLanguageMapping(doctor_id=new_doctor.id, language_id=lang_id, created_by=user.id))
        
        if "specialty_ids" in data:
            for spec_id in data["specialty_ids"]:
                db.add(DoctorSpecialityMapping(doctor_id=new_doctor.id, speciality_id=spec_id, created_by=user.id))

        db.commit()
        db.refresh(new_doctor)
        return new_doctor

