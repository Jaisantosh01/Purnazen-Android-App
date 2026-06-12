from app.extensions.database import db


class DoctorExpertise(db.Model):

    __tablename__ = "doctor_expertise"

    doctor_id = db.Column(
        db.Integer,
        db.ForeignKey("doctors.id"),
        primary_key=True
    )

    expertise_id = db.Column(
        db.Integer,
        db.ForeignKey("expertise.id"),
        primary_key=True
    )