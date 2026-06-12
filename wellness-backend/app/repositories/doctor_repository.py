from app.models.doctor_model import Doctor
from app.models.user_model import User

class DoctorRepository:

    @staticmethod
    def get_doctors(page, limit, search):

        query = Doctor.query

        # Search by doctor name
        if search:
            query = (
                query
                .join(User)
                .filter(
                    User.full_name.ilike(
                        f"%{search}%"
                    )
                )
            )

        # Total records
        total = query.count()

        # Pagination
        doctors = (
            query
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        return doctors, total