from datetime import date
from sqlalchemy.orm import Session
from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.user import User
from app.models.doctor_leave import DoctorLeave

class DashboardService:
    @staticmethod
    def get_stats(db: Session):
        total_active_doctors = db.query(Doctor).filter(Doctor.is_active == True).count()
        total_inactive_doctors = db.query(Doctor).filter(Doctor.is_active == False).count()
        scheduled_appointments = db.query(Appointment).filter(~Appointment.status.in_(["completed", "cancelled"])).count()
        today_appointments = db.query(Appointment).filter(Appointment.date == date.today()).count()
        total_active_users = db.query(User).filter(User.is_active == True).count()

        today_doctor_leaves = db.query(DoctorLeave).filter(
            DoctorLeave.start_date <= date.today(),
            DoctorLeave.end_date >= date.today(),
            DoctorLeave.is_active == True,
            DoctorLeave.status.in_(["approved", "pending"]),
        ).count()
        total_doctor_leaves = db.query(DoctorLeave).filter(
            DoctorLeave.is_active == True,
            DoctorLeave.status.in_(["approved", "pending"]),
        ).count()

        return {
            "total_active_doctors": total_active_doctors,
            "total_inactive_doctors": total_inactive_doctors,
            "scheduled_appointments": scheduled_appointments,
            "today_appointments": today_appointments,
            "total_active_users": total_active_users,
            "today_doctor_leaves": today_doctor_leaves,
            "total_doctor_leaves": total_doctor_leaves,
        }
