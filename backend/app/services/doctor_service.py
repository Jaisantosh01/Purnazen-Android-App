from datetime import date as date_type, datetime

import uuid

from sqlalchemy.orm import Session

from app.models.award import Award
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
    def get_doctor_by_id(db: Session, doctor_id: uuid.UUID) -> Doctor | None:
        return DoctorRepository.get_by_id(db, doctor_id)

    @staticmethod
    def get_visit_types(doctor: Doctor) -> list[dict]:
        fee = float(doctor.consultation_fee)
        visit_types = []
        for link in doctor.consultation_type_links:
            ct_name = link.consultation_type.name
            meta = VISIT_TYPE_PRESENTATION.get(
                ct_name,
                {
                    "id": ct_name.lower().replace(" ", "-"),
                    "title": ct_name,
                    "subtitle": "",
                    "icon": "🩺",
                },
            )
            visit_types.append(
                {**meta, "fee": float(link.price) if link.price else fee, "consultationTypeId": link.consultation_type.id}
            )
        return visit_types

    @staticmethod
    def get_time_slots(db: Session, doctor: Doctor, on_date: date_type) -> list[dict]:
        """Return bookable slot blocks for the doctor on a given date.

        Reads the doctor's ``availabilities`` (doctor_availability table), joins
        through ``SlotTimings`` → ``DayOfWeek`` to match the weekday,
        and excludes slot_timing_ids that are already booked.
        """
        day_name = on_date.strftime("%A")
        booked_ids = AppointmentRepository.get_booked_slot_ids(db, doctor.id, on_date)

        from app.models.doctor_availability import DoctorAvailability
        from app.models.slot_timings import SlotTimings
        from app.models.day_of_week import DayOfWeek

        rows = (
            db.query(DoctorAvailability, SlotTimings)
            .join(SlotTimings, DoctorAvailability.slot_timing_id == SlotTimings.id)
            .join(DayOfWeek, SlotTimings.day_of_week_id == DayOfWeek.id)
            .filter(
                DoctorAvailability.doctor_id == doctor.id,
                DoctorAvailability.is_active == True,
                DayOfWeek.day == day_name,
            )
            .order_by(SlotTimings.start_time)
            .all()
        )

        slots = []
        for av, st in rows:
            if st.id in booked_ids:
                continue
            slots.append({
                "id": str(st.id),
                "time": st.start_time.strftime("%I:%M %p"),
                "end_time": st.end_time.strftime("%I:%M %p"),
            })

        return slots

    @staticmethod
    def update(db: Session, doctor_id: uuid.UUID, data: dict, user):
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

        # Update slot timing availability
        if "slot_timing_ids" in data:
            from app.models.doctor_availability import DoctorAvailability
            db.query(DoctorAvailability).filter_by(doctor_id=doctor.id).delete()
            for st_id in data["slot_timing_ids"]:
                db.add(DoctorAvailability(
                    doctor_id=doctor.id,
                    slot_timing_id=st_id,
                    created_by=user.id,
                ))

        # Update Awards
        if "awards" in data:
            db.query(Award).filter_by(doctor_id=doctor.id).delete()
            for award_data in data["awards"]:
                db.add(Award(
                    doctor_id=doctor.id,
                    title=award_data["title"],
                    issuer=award_data.get("issuer"),
                    year=award_data.get("year"),
                    description=award_data.get("description"),
                    created_by=user.id
                ))

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
        
        # Initialize slot timing availability
        if "slot_timing_ids" in data:
            from app.models.doctor_availability import DoctorAvailability
            for st_id in data["slot_timing_ids"]:
                db.add(DoctorAvailability(
                    doctor_id=new_doctor.id,
                    slot_timing_id=st_id,
                    created_by=user.id,
                ))

        # Initialize Awards
        if "awards" in data:
            for award_data in data["awards"]:
                db.add(Award(
                    doctor_id=new_doctor.id,
                    title=award_data["title"],
                    issuer=award_data.get("issuer"),
                    year=award_data.get("year"),
                    description=award_data.get("description"),
                    created_by=user.id
                ))

        db.commit()
        db.refresh(new_doctor)
        return new_doctor
