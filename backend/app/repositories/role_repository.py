from sqlalchemy.orm import Session
from app.models.role import Role

class RoleRepository:
    @staticmethod
    def get_by_id(db: Session, role_id: int):
        return db.get(Role, role_id)
    
    @staticmethod
    def save(db: Session, role: Role):
        db.add(role)
        db.commit()
        db.refresh(role)
        return role
