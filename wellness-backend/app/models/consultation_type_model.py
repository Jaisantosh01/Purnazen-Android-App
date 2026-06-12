from app.extensions.database import db


class ConsultationType(db.Model):

    __tablename__ = "consultation_types"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(50),
        nullable=False,
        unique=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name
        }
    