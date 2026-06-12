from datetime import date as date_cls
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.doctor_service import DoctorService
from app.utils.responses import error_response, success_response

router = APIRouter(tags=["Doctors"])


def doctor_card(doctor):
    """Card shape shared by the list and detail endpoints (frontend contract)."""
    return {
        "id": str(doctor.id),
        "name": f"Dr. {doctor.user.full_name}",
        "specialty": doctor.specialty.name,
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
        "expertise": [expertise.name for expertise in doctor.expertises],
        "languages": [language.name for language in doctor.languages],
        "awards": [award.title for award in doctor.awards],
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
    doctors, total = DoctorService.get_doctors(db, page, limit, search)

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
