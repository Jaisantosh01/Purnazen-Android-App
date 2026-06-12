from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.services.doctor_service import DoctorService

router = APIRouter(tags=["Doctors"])


@router.get("/doctors")
def get_doctors(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default=""),
    db: Session = Depends(get_db),
):
    doctors, total = DoctorService.get_doctors(db, page, limit, search)

    response = [
        {
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
        for doctor in doctors
    ]

    return {
        "success": True,
        "data": {
            "doctors": response,
            "total": total,
            "page": page,
            "limit": limit,
        },
    }
