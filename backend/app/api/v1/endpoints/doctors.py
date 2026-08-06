from datetime import date as date_cls
from datetime import datetime

from typing import Optional
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.services.doctor_service import DoctorService, VISIT_TYPE_ORDER
from app.utils.responses import error_response, success_response
from app.utils.names import format_doctor_name
from app.models.user import User

router = APIRouter(tags=["Doctors"])


def doctor_card(doctor):
    """Card shape shared by the list and detail endpoints (frontend contract)."""
    base_fee = float(doctor.consultation_fee)
    # Cheapest option across the doctor's consultation types (per-type price
    # falls back to the base consultation fee) — drives "Starts at ₹X" cards.
    type_fees = [
        float(link.price) if link.price else base_fee
        for link in doctor.consultation_type_links
    ]
    return {
        "id": str(doctor.id),
        "name": format_doctor_name(doctor.user.full_name),
        "full_name": doctor.user.full_name,
        "email": doctor.user.email,
        "phone": doctor.user.phone,
        "specialties": [mapping.specialty.name for mapping in doctor.speciality_mappings],
        "specialty_ids": [mapping.speciality_id for mapping in doctor.speciality_mappings],
        # Loadable image URL when set, else null — the app falls back to the
        # doctor's initial (no emoji, which renders inconsistently across
        # devices). `User.avatar` resolves an uploaded blob path to a SAS URL;
        # the raw `avatar_url` column is a bare path the client can't fetch.
        "avatar": doctor.user.avatar,
        "rating": float(doctor.average_rating),
        "reviews": doctor.reviews_count,
        "experience": doctor.experience_years,
        "location": "",
        "tags": sorted(
            [link.consultation_type.name for link in doctor.consultation_type_links],
            key=lambda name: VISIT_TYPE_ORDER.get(name, 9),
        ),
        "fee": base_fee,
        "minFee": min(type_fees) if type_fees else base_fee,
        # Which visit modes this doctor offers and what each costs. Drives the
        # admin edit screen; `price` is null when the base fee applies.
        "consultation_types": [
            {
                "consultation_type_id": str(link.consultation_type_id),
                "name": link.consultation_type.name,
                "price": float(link.price) if link.price is not None else None,
            }
            for link in sorted(
                doctor.consultation_type_links,
                key=lambda link: VISIT_TYPE_ORDER.get(link.consultation_type.name, 9),
            )
        ],
        "availability": (
            "Available today" if doctor.is_available_today else "Not Available"
        ),
        "availableToday": doctor.is_available_today,
        "about": doctor.about,
        "education": doctor.education,
        "expertise": [mapping.expertise.name for mapping in doctor.expertise_mappings],
        "expertise_ids": [mapping.expertise_id for mapping in doctor.expertise_mappings],
        "languages": [mapping.language.name for mapping in doctor.language_mappings],
        "language_ids": [mapping.language_id for mapping in doctor.language_mappings],
        "awards": [
            {
                "id": award.id,
                "title": award.title,
                "issuer": award.issuer,
                "year": award.year,
                "description": award.description,
            }
            for award in doctor.awards
        ],
        "clinics": [
            {
                "id": str(clinic.id),
                "name": clinic.name,
                "address": clinic.address,
                "city": clinic.city,
                "latitude": clinic.latitude,
                "longitude": clinic.longitude,
                "phone": clinic.phone,
                "is_primary": clinic.is_primary,
            }
            # Clinics that still have appointments booked can't be deleted, so
            # removing one deactivates it — keep those out of the card.
            for clinic in doctor.clinics
            if clinic.is_active is not False
        ],
        "is_active": doctor.is_active,
    }


def _doctor_list(db, page, limit, search, filter_key=None, is_active=None):
    """Shared list/total payload for the catalog and filter endpoints."""
    doctors, total = DoctorService.get_doctors(db, page, limit, search, filter_key, is_active)

    return {
        "success": True,
        "data": {
            "doctors": [doctor_card(doctor) for doctor in doctors],
            "total": total,
            "page": page,
            "limit": limit,
        },
    }


@router.get(
    "/doctors",
    summary="List doctors",
    description="Paginated doctor catalog; `search` matches doctor name and specialty.",
)
def get_doctors(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, is_active=is_active)


# NOTE: these static paths must stay registered before /doctors/{doctor_id},
# otherwise the int path converter swallows them.
@router.get(
    "/doctors/available-today",
    summary="Doctors available today",
    description="Same shape as the catalog, filtered to doctors available today.",
)
def get_doctors_available_today(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "available_today", is_active)


@router.get(
    "/doctors/video-call",
    summary="Doctors offering video consultations",
    description="Same shape as the catalog, filtered by the Video Call consultation type.",
)
def get_doctors_video_call(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "video", is_active)


@router.get(
    "/doctors/home-visit",
    summary="Doctors offering home visits",
    description="Same shape as the catalog, filtered by the Home Visit consultation type.",
)
def get_doctors_home_visit(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "home", is_active)


@router.get(
    "/doctors/top-rated",
    summary="Top-rated doctors",
    description="Doctors rated 4.5+, ordered by rating descending; same shape as the catalog.",
)
def get_doctors_top_rated(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "top_rated", is_active)


@router.get(
    "/doctors/{doctor_id}",
    summary="Doctor detail",
    description="Single doctor in the same card shape as the list endpoint; 404 when missing.",
)
def get_doctor(doctor_id: uuid.UUID, db: Session = Depends(get_db)):
    doctor = DoctorService.get_doctor_by_id(db, doctor_id)
    if not doctor:
        return error_response("Doctor not found", 404)

    return success_response("Doctor fetched successfully", doctor_card(doctor))


@router.get(
    "/doctors/{doctor_id}/visit-types",
    summary="Doctor visit types",
    description="Visit-type cards (video/home/clinic) derived from the doctor's consultation types.",
)
def get_visit_types(doctor_id: uuid.UUID, db: Session = Depends(get_db)):
    doctor = DoctorService.get_doctor_by_id(db, doctor_id)
    if not doctor:
        return error_response("Doctor not found", 404)

    return success_response(
        "Visit types fetched successfully",
        {"visitTypes": DoctorService.get_visit_types(doctor)},
    )


@router.post(
    "/doctors",
    summary="Create a new doctor",
    dependencies=[Depends(require_role("admin"))],
)
def create_doctor(
    data: dict, 
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    new_doctor = DoctorService.create(db, data, user)
    if not new_doctor:
        return error_response("Failed to create doctor", 400)
    return success_response("Doctor created successfully", doctor_card(new_doctor))


@router.put(
    "/doctors/{doctor_id}",
    summary="Update doctor details",
    dependencies=[Depends(require_role("admin"))],
)
def update_doctor(
    doctor_id: uuid.UUID, 
    data: dict, 
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    updated_doctor = DoctorService.update(db, doctor_id, data, user)
    if not updated_doctor:
        return error_response("Doctor not found", 404)
    return success_response("Doctor updated successfully", doctor_card(updated_doctor))


@router.delete(
    "/doctors/{doctor_id}",
    summary="Deactivate a doctor",
    description="Sets is_active=False on both the doctor and the linked user.",
    dependencies=[Depends(require_role("admin"))],
)
def delete_doctor(
    doctor_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not DoctorService.deactivate(db, doctor_id):
        return error_response("Doctor not found", 404)

    return success_response("Doctor deactivated successfully")


@router.get(
    "/doctors/{doctor_id}/availability",
    summary="Doctor weekly availability",
    description="Returns the slot_timing_ids that this doctor is available for (weekly schedule).",
)
def get_doctor_availability(
    doctor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    doctor = DoctorService.get_doctor_by_id(db, doctor_id)
    if not doctor:
        return error_response("Doctor not found", 404)

    from app.models.doctor_availability import DoctorAvailability
    rows = db.query(DoctorAvailability).filter(
        DoctorAvailability.doctor_id == doctor_id,
        DoctorAvailability.is_active == True,
    ).all()

    return success_response(
        "Doctor availability fetched successfully",
        [{"slot_timing_id": str(a.slot_timing_id)} for a in rows]
    )


@router.get(
    "/doctors/{doctor_id}/time-slots",
    summary="Available time slots",
    description=(
        "Bookable slots for a date (YYYY-MM-DD), generated from the doctor's weekly "
        "availability minus already-booked appointments."
    ),
)
def get_time_slots(
    doctor_id: uuid.UUID,
    date: str = Query(description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    doctor = DoctorService.get_doctor_by_id(db, doctor_id)
    if not doctor:
        return error_response("Doctor not found", 404)

    try:
        on_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        return error_response("Invalid date format. Use YYYY-MM-DD.", 400)

    if on_date < date_cls.today():
        return error_response("Date must not be in the past", 400)

    return success_response(
        "Time slots fetched successfully",
        {"date": date, "slots": DoctorService.get_time_slots(db, doctor, on_date)},
    )
