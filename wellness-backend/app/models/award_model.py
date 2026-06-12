from app.extensions.database import db

class Award(db.Model):
    __tablename__ = "awards"
    
    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    issuer = db.Column(db.String(255))
    year = db.Column(db.Integer)
    description = db.Column(db.Text)
    

    def to_dict(self):
        return {
            "id": self.id,
            "doctor_id": self.doctor_id,
            "title": self.title,
            "issuer": self.issuer,
            "year": self.year,
            "description": self.description
        }