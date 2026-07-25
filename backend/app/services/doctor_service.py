from datetime import date as date_type, datetime

import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.award import Award
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.doctor_expertise_mapping import DoctorExpertiseMapping
from app.models.doctor_language_mapping import DoctorLanguageMapping
from app.models.doctor_speciality_mapping import DoctorSpecialityMapping
from app.models.role import Role
from app.models.user import User
from app.repositories.appointment_repository import AppointmentRepository
from app.repositories.doctor_repository import DoctorRepository

# Presentation metadata for the BookAppointmentScreen visit-type cards,
# keyed by the consultation_types.name lookup values.
# `icon` values are MaterialCommunityIcons names rendered by the app via
# <MCIcon name=... />, not emoji — keep them as icon identifiers.
VISIT_TYPE_PRESENTATION = {
    "Video Call": {
        "id": "video",
        "title": "Video Consultation",
        "subtitle": "Consult from anywhere",
        "icon": "video-outline",
    },
    "Home Visit": {
        "id": "home",
        "title": "Home Visit",
        "subtitle": "Doctor visits your home",
        "icon": "home-outline",
    },
    "Clinic Visit": {
        "id": "clinic",
        "title": "Clinic Visit",
        "subtitle": "Meet at the clinic",
        "icon": "hospital-building",
    },
}

# Reverse map: frontend visit-type slug -> consultation_types.name
VISIT_SLUG_TO_CONSULTATION_TYPE = {
    meta["id"]: name for name, meta in VISIT_TYPE_PRESENTATION.items()
}

# Display order for visit types / consultation-type tags: clinic first, then
# home, then video (unknown types last, in their original order).
VISIT_TYPE_ORDER = {"Clinic Visit": 0, "Home Visit": 1, "Video Call": 2}


def _first_present(data: dict, keys: tuple[str, ...], fallback):
    """First key actually present in the payload, else the current value."""
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return fallback


def _to_float(value):
    """Coerce a lat/long coming off a text input; blank or junk -> None."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


class DoctorService:

    @staticmethod
    def get_doctors(
        db: Session, page: int, limit: int, search: str, filter_key: str | None = None,
        is_active: bool | None = None,
    ):
        return DoctorRepository.get_doctors(db, page, limit, search, filter_key, is_active)

    @staticmethod
    def get_doctor_by_id(db: Session, doctor_id: uuid.UUID) -> Doctor | None:
        return DoctorRepository.get_by_id(db, doctor_id)

    @staticmethod
    def get_visit_types(doctor: Doctor) -> list[dict]:
        fee = float(doctor.consultation_fee)
        visit_types = []
        links = sorted(
            doctor.consultation_type_links,
            key=lambda link: VISIT_TYPE_ORDER.get(link.consultation_type.name, 9),
        )
        for link in links:
            ct_name = link.consultation_type.name
            meta = VISIT_TYPE_PRESENTATION.get(
                ct_name,
                {
                    "id": ct_name.lower().replace(" ", "-"),
                    "title": ct_name,
                    "subtitle": "",
                    "icon": "stethoscope",
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
        and excludes slot_timing_ids that are already booked or blocked by approved leave.
        """
        day_name = on_date.strftime("%A")
        booked_ids = AppointmentRepository.get_booked_slot_ids(db, doctor.id, on_date)

        from app.models.doctor_availability import DoctorAvailability
        from app.models.slot_timings import SlotTimings
        from app.models.day_of_week import DayOfWeek
        from app.models.doctor_leave import DoctorLeave
        from app.models.doctor_leave_slot import DoctorLeaveSlot

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

        # Get all approved active leaves for this doctor
        leaves = (
            db.query(DoctorLeave)
            .filter(
                DoctorLeave.doctor_id == doctor.id,
                DoctorLeave.status == "approved",
                DoctorLeave.is_active == True,
            )
            .all()
        )

        blocked_slots_by_leave = set()
        for leave in leaves:
            # Check date overlap
            date_matches = False
            if leave.start_date and leave.end_date:
                if leave.start_date <= on_date <= leave.end_date:
                    date_matches = True
            elif leave.leave_date:
                if leave.leave_date == on_date:
                    date_matches = True

            if not date_matches:
                continue

            # Determine blocked slots based on leave type
            if leave.leave_type == "multiple":
                for av, st in rows:
                    blocked_slots_by_leave.add(st.id)
            elif leave.leave_type == "single":
                if leave.start_time and leave.end_time:
                    for av, st in rows:
                        if st.start_time < leave.end_time and st.end_time > leave.start_time:
                            blocked_slots_by_leave.add(st.id)
                elif leave.slot_timing_id:
                    blocked_slots_by_leave.add(leave.slot_timing_id)
                else:
                    for av, st in rows:
                        blocked_slots_by_leave.add(st.id)
            elif leave.leave_type == "custom":
                custom_slots = (
                    db.query(DoctorLeaveSlot.slot_timing_id)
                    .filter(DoctorLeaveSlot.leave_id == leave.id)
                    .all()
                )
                for (stid,) in custom_slots:
                    blocked_slots_by_leave.add(stid)

        slots = []
        booked_str = {str(b) for b in booked_ids}
        for av, st in rows:
            # Booked slots stay in the list flagged `booked: true` (the booking
            # UI greys them out); only leave-blocked slots are omitted entirely.
            if st.id in blocked_slots_by_leave:
                continue
            slots.append({
                "id": str(st.id),
                "time": st.start_time.strftime("%I:%M %p"),
                "end_time": st.end_time.strftime("%I:%M %p"),
                "booked": str(st.id) in booked_str,
            })

        return slots

    @staticmethod
    def update(db: Session, doctor_id: uuid.UUID, data: dict, user):
        doctor = db.get(Doctor, doctor_id)
        if not doctor:
            return None

        # Update linked user fields
        if "full_name" in data:
            doctor.user.full_name = data["full_name"]
        if "email" in data:
            existing = db.query(User).filter(
                User.email == data["email"], User.id != doctor.user_id
            ).first()
            if not existing:
                doctor.user.email = data["email"]
        if "phone" in data:
            doctor.user.phone = data.get("phone", doctor.user.phone)

        # Update basic fields. The admin app round-trips the doctor_card shape,
        # which names these `experience`/`fee` — accept both spellings or the
        # edits are silently dropped.
        doctor.about = data.get("about", doctor.about)
        doctor.education = data.get("education", doctor.education)
        doctor.experience_years = _first_present(
            data, ("experience_years", "experience"), doctor.experience_years
        )
        doctor.consultation_fee = _first_present(
            data, ("consultation_fee", "fee"), doctor.consultation_fee
        )
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

        # Update Awards — merged by id so ids stay stable across edits.
        if "awards" in data:
            existing_awards = {
                str(a.id): a
                for a in db.query(Award).filter_by(doctor_id=doctor.id).all()
            }
            kept_awards = set()
            for award_data in data["awards"]:
                award = existing_awards.get(str(award_data.get("id")))
                if award is None:
                    award = Award(doctor_id=doctor.id, created_by=user.id)
                    db.add(award)
                else:
                    kept_awards.add(str(award.id))
                    award.updated_by = user.id
                award.title = award_data.get("title") or ""
                award.issuer = award_data.get("issuer")
                award.year = award_data.get("year")
                award.description = award_data.get("description")
            for award_id, award in existing_awards.items():
                if award_id not in kept_awards:
                    db.delete(award)

        # Update Clinics — merged by id. A clinic that already has appointments
        # booked against it cannot be deleted (appointments.clinic_id FK), so
        # removing it deactivates it instead of blowing up the whole save.
        if "clinics" in data:
            existing_clinics = {
                str(c.id): c
                for c in db.query(Clinic).filter_by(doctor_id=doctor.id).all()
            }
            kept_clinics = set()
            for clinic_data in data["clinics"]:
                clinic = existing_clinics.get(str(clinic_data.get("id")))
                if clinic is None:
                    clinic = Clinic(doctor_id=doctor.id, created_by=user.id)
                    db.add(clinic)
                else:
                    kept_clinics.add(str(clinic.id))
                    clinic.updated_by = user.id
                clinic.name = clinic_data.get("name") or ""
                clinic.address = clinic_data.get("address") or ""
                clinic.city = clinic_data.get("city") or ""
                clinic.latitude = _to_float(clinic_data.get("latitude"))
                clinic.longitude = _to_float(clinic_data.get("longitude"))
                clinic.phone = clinic_data.get("phone")
                clinic.is_primary = bool(clinic_data.get("is_primary", False))
                clinic.is_active = True
            for clinic_id, clinic in existing_clinics.items():
                if clinic_id in kept_clinics:
                    continue
                if AppointmentRepository.clinic_in_use(db, clinic.id):
                    clinic.is_active = False
                else:
                    db.delete(clinic)

        doctor.updated_at = datetime.utcnow()
        doctor.updated_by = user.id
        db.commit()
        db.refresh(doctor)
        return doctor

    @staticmethod
    def create(db: Session, data: dict, user):
        if not data.get("user_id"):
            full_name = data.get("name") or data.get("full_name")
            if not full_name or not data.get("email") or not data.get("password"):
                return None

            doctor_role = db.query(Role).filter_by(name="doctor").first()
            if not doctor_role:
                return None

            existing_user = db.query(User).filter_by(email=data["email"]).first()
            if existing_user:
                return None

            new_user = User(
                full_name=full_name,
                email=data["email"],
                password=hash_password(data["password"]),
                role_id=doctor_role.id,
                phone=data.get("phone"),
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            data["user_id"] = new_user.id
            
        new_doctor = Doctor(
            user_id=data["user_id"],
            specialty_id=data.get("specialty_ids", [None])[0] if data.get("specialty_ids") else None,
            about=data.get("about", ""),
            education=data.get("education", ""),
            experience_years=_first_present(data, ("experience", "experience_years"), 0),
            consultation_fee=_first_present(data, ("fee", "consultation_fee"), 0),
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

        # Initialize Clinics
        if "clinics" in data:
            for clinic_data in data["clinics"]:
                db.add(Clinic(
                    doctor_id=new_doctor.id,
                    name=clinic_data.get("name") or "",
                    address=clinic_data.get("address") or "",
                    city=clinic_data.get("city") or "",
                    latitude=_to_float(clinic_data.get("latitude")),
                    longitude=_to_float(clinic_data.get("longitude")),
                    phone=clinic_data.get("phone"),
                    is_primary=clinic_data.get("is_primary", False),
                    created_by=user.id,
                ))

        db.commit()
        db.refresh(new_doctor)
        return new_doctor

    @staticmethod
    def deactivate(db: Session, doctor_id: uuid.UUID) -> bool:
        doctor = db.get(Doctor, doctor_id)
        if not doctor:
            return False
        doctor.is_active = False
        doctor.user.is_active = False
        db.commit()
        return True
