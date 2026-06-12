from app.repositories.doctor_repository import (
    DoctorRepository
)


class DoctorService:

    @staticmethod
    def get_doctors(page, limit, search):

        return DoctorRepository.get_doctors(page, limit, search)