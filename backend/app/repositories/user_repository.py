from sqlalchemy.orm import Session

from app.models.user import User
from app.models.role import Role


class UserRepository:

    @staticmethod
    def find_by_email(db: Session, email: str):
        return db.query(User).filter_by(email=email).first()

    @staticmethod
    def find_by_id(db: Session, user_id: int):
        return db.get(User, user_id)

    @staticmethod
    def create_user(db: Session, data: dict):
        # Find default patient role
        patient_role = db.query(Role).filter_by(name="patient").first()
        
        user = User(
            full_name=data["full_name"],
            email=data["email"],
            password=data["password"],
            role_id=patient_role.id if patient_role else None
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
