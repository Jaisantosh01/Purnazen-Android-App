from datetime import date as date_cls
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.services.doctor_service import DoctorService
from app.utils.responses import error_response, success_response
from app.models.user import User

router = APIRouter(tags=["Doctors"])


def doctor_card(doctor):
    """Card shape shared by the list and detail endpoints (frontend contract)."""
    return {
        "id": str(doctor.id),
        "name": f"Dr. {doctor.user.full_name}",
        "specialties": [mapping.specialty.name for mapping in doctor.speciality_mappings],
        "specialty_ids": [mapping.speciality_id for mapping in doctor.speciality_mappings],
        "avatar": doctor.user.avatar_url or "👨‍⚕️",
        "rating": float(doctor.average_rating),
        "reviews": doctor.reviews_count,
        "experience": doctor.experience_years,
        "location": "",
        "tags": [ct.name for ct in doctor.consultation_types],
        "fee": float(doctor.consultation_fee),
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
        "awards": [award.title for award in doctor.awards],
    }


def _doctor_list(db, page, limit, search, filter_key=None):
    """Shared list/total payload for the catalog and filter endpoints."""
    doctors, total = DoctorService.get_doctors(db, page, limit, search, filter_key)

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
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search)


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
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "available_today")


@router.get(
    "/doctors/video-call",
    summary="Doctors offering video consultations",
    description="Same shape as the catalog, filtered by the Video Call consultation type.",
)
def get_doctors_video_call(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "video")


@router.get(
    "/doctors/home-visit",
    summary="Doctors offering home visits",
    description="Same shape as the catalog, filtered by the Home Visit consultation type.",
)
def get_doctors_home_visit(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "home")


@router.get(
    "/doctors/top-rated",
    summary="Top-rated doctors",
    description="Doctors rated 4.5+, ordered by rating descending; same shape as the catalog.",
)
def get_doctors_top_rated(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    db: Session = Depends(get_db),
):
    return _doctor_list(db, page, limit, search, "top_rated")


@router.get(
    "/doctors/{doctor_id}",
    summary="Doctor detail",
    description="Single doctor in the same card shape as the list endpoint; 404 when missing.",
)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = DoctorService.get_doctor_by_id(db, doctor_id)
    if not doctor:
        return error_response("Doctor not found", 404)

    return success_response("Doctor fetched successfully", doctor_card(doctor))


@router.get(
    "/doctors/{doctor_id}/visit-types",
    summary="Doctor visit types",
    description="Visit-type cards (video/home/clinic) derived from the doctor's consultation types.",
)
def get_visit_types(doctor_id: int, db: Session = Depends(get_db)):
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
    doctor_id: int, 
    data: dict, 
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    updated_doctor = DoctorService.update(db, doctor_id, data, user)
    if not updated_doctor:
        return error_response("Doctor not found", 404)
    return success_response("Doctor updated successfully", doctor_card(updated_doctor))


@router.get(
    "/doctors/{doctor_id}/time-slots",
    summary="Available time slots",
    description=(
        "Bookable slots for a date (YYYY-MM-DD), generated from the doctor's weekly "
        "availability minus already-booked appointments."
    ),
)
def get_time_slots(
    doctor_id: int,
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
