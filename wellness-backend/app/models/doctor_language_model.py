from app.extensions.database import db


class DoctorLanguage(db.Model):

    __tablename__ = "doctor_languages"

    doctor_id = db.Column(
        db.Integer,
        db.ForeignKey("doctors.id"),
        primary_key=True
    )

    language_id = db.Column(
        db.Integer,
        db.ForeignKey("languages.id"),
        primary_key=True
    )