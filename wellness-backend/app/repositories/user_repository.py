from app.models.user_model import User
from app.extensions.database import db

class UserRepository:

    @staticmethod
    def find_by_email(email):

        return User.query.filter_by(email=email).first()


    @staticmethod
    def create_user(data):

        user = User(
            full_name=data['full_name'],
            email=data['email'],
            password=data['password']
        )

        db.session.add(user)
        db.session.commit()

        return user