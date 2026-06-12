from app.extensions.database import db


class DoctorConsultationType(db.Model):

    __tablename__ = "doctor_consultation_types"

    doctor_id = db.Column(
        db.Integer,
        db.ForeignKey("doctors.id"),
        primary_key=True
    )

    consultation_type_id = db.Column(
        db.Integer,
        db.ForeignKey("consultation_types.id"),
        primary_key=True
    )