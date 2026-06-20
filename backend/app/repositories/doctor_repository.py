import uuid

from sqlalchemy.orm import Session

from app.models.consultation_type import ConsultationType
from app.models.doctor import Doctor
from app.models.user import User

TOP_RATED_MIN_RATING = 4.5

# filter_key -> consultation_types.name for the m2m-based filters
_CONSULTATION_TYPE_FILTERS = {
    "video": "Video Call",
    "home": "Home Visit",
}


class DoctorRepository:

    @staticmethod
    def get_by_id(db: Session, doctor_id: uuid.UUID) -> Doctor | None:
        return db.get(Doctor, doctor_id)

    @staticmethod
    def get_doctors(
        db: Session, page: int, limit: int, search: str, filter_key: str | None = None
    ):
        query = db.query(Doctor)

        if search:
            query = query.join(User, Doctor.user_id == User.id).filter(
                User.full_name.ilike(f"%{search}%")
            )

        if filter_key == "available_today":
            query = query.filter(Doctor.is_available_today.is_(True))
        elif filter_key in _CONSULTATION_TYPE_FILTERS:
            query = query.join(Doctor.consultation_types).filter(
                ConsultationType.name == _CONSULTATION_TYPE_FILTERS[filter_key]
            )
        elif filter_key == "top_rated":
            query = query.filter(Doctor.average_rating >= TOP_RATED_MIN_RATING)

        total = query.count()

        if filter_key == "top_rated":
            query = query.order_by(Doctor.average_rating.desc())

        doctors = query.offset((page - 1) * limit).limit(limit).all()

        return doctors, total
