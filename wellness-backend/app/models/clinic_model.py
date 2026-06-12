from app.extensions.database import db

class Clinic(db.Model):
    __tablename__ = "clinics"
    
    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    address = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float)  # For map integration
    longitude = db.Column(db.Float)
    phone = db.Column(db.String(20))
    is_primary = db.Column(db.Boolean, default=False)

    doctor = db.relationship(
        "Doctor",
        back_populates="clinics"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "doctor_id": self.doctor_id,
            "name": self.name,
            "address": self.address,
            "city": self.city,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "phone": self.phone,
            "is_primary": self.is_primary
        }