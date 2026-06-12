from app.extensions.database import db

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    full_name = db.Column(db.String(100), nullable=False)

    # In User model, add:
    avatar_url = db.Column(db.String(500))

    email = db.Column(db.String(120), unique=True, nullable=False)

    password = db.Column(db.String(255), nullable=False)

    role = db.Column(db.String(50), default="patient")

    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
            "email": self.email,        
            "role": self.role,
            "created_at": self.created_at.isoformat()   
        }
    
    def __repr__(self):
        return f"<User {self.email}>"