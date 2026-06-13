from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:

    @staticmethod
    def find_by_email(db: Session, email: str):
        return db.query(User).filter_by(email=email).first()

    @staticmethod
    def find_by_id(db: Session, user_id: int):
        return db.get(User, user_id)

    @staticmethod
    def create_user(db: Session, data: dict):
        user = User(
            full_name=data["full_name"],
            email=data["email"],
            password=data["password"],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
