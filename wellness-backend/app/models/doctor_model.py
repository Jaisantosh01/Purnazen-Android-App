from app.extensions.database import db


class Doctor(db.Model):

    __tablename__ = "doctors"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    specialty_id = db.Column(
        db.Integer,
        db.ForeignKey("specialties.id"),
        nullable=False
    )

    about = db.Column(db.Text)

    education = db.Column(db.Text)

    experience_years = db.Column(
        db.Integer,
        nullable=False
    )

    consultation_fee = db.Column(
        db.Numeric(10, 2),
        nullable=False
    )

    average_rating = db.Column(
        db.Numeric(3, 2),
        default=0
    )

    reviews_count = db.Column(
        db.Integer,
        default=0
    )

    clinics = db.relationship(
        "Clinic",
        back_populates="doctor",
        cascade="all, delete-orphan"
    )
    awards = db.relationship("Award", backref="doctor")
    availabilities = db.relationship("DoctorAvailability", backref="doctor")

    
    languages = db.relationship(
        "Language",
        secondary="doctor_languages",
        backref="doctors"
    )

    consultation_types = db.relationship(
        "ConsultationType",
        secondary="doctor_consultation_types",
        backref="doctors"
    )

    expertises = db.relationship(
        "Expertise",
        secondary="doctor_expertise",
        backref="doctors"
    )

    is_available_today = db.Column(
        db.Boolean,
        default=False
    )

    created_at = db.Column(
        db.DateTime,
        server_default=db.func.now()
    )

    user = db.relationship(
        "User",
        backref="doctor_profile"
    )

    specialty = db.relationship(
        "Specialty",
        backref="doctors"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "specialty_id": self.specialty_id,
            "about": self.about,
            "education": self.education,
            "experience_years": self.experience_years,
            "consultation_fee": float(self.consultation_fee),
            "average_rating": float(self.average_rating),
            "reviews_count": self.reviews_count,
            "languages": [lang.to_dict() for lang in self.languages],
            "consultation_types": [consult_type.to_dict() for consult_type in self.consultation_types],
            "expertises": [expertise.to_dict() for expertise in self.expertises],
            "is_available_today": self.is_available_today,
            "created_at": self.created_at.isoformat(),
            "user": self.user.to_dict(),
            "specialty": self.specialty.to_dict(),
            "clinics": [clinic.to_dict() for clinic in self.clinics],
            "awards": [award.to_dict() for award in self.awards],
            "availabilities": [availability.to_dict() for availability in self.availabilities]
        }
    