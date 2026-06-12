from app.extensions.database import db


class Expertise(db.Model):

    __tablename__ = "expertise"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(100),
        nullable=False,
        unique=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name
        }
    