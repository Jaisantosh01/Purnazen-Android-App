from sqlalchemy.orm import Session

from app.repositories.doctor_repository import DoctorRepository


class DoctorService:

    @staticmethod
    def get_doctors(db: Session, page: int, limit: int, search: str):
        return DoctorRepository.get_doctors(db, page, limit, search)
