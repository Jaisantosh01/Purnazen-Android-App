from sqlalchemy.orm import Session

from app.models.doctor import Doctor
from app.models.user import User


class DoctorRepository:

    @staticmethod
    def get_by_id(db: Session, doctor_id: int) -> Doctor | None:
        return db.get(Doctor, doctor_id)

    @staticmethod
    def get_doctors(db: Session, page: int, limit: int, search: str):
        query = db.query(Doctor)

        if search:
            query = query.join(User, Doctor.user_id == User.id).filter(
                User.full_name.ilike(f"%{search}%")
            )

        total = query.count()
        doctors = query.offset((page - 1) * limit).limit(limit).all()

        return doctors, total
