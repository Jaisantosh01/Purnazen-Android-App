from sqlalchemy.orm import Session
from app.models.role import Role
from app.repositories.role_repository import RoleRepository
from datetime import datetime

class RoleService:
    @staticmethod
    def get_all(db: Session):
        return db.query(Role).filter(Role.is_active == True).all()

    @staticmethod
    def create(db: Session, data: dict, user):
        role = Role(name=data["name"], icon=data.get("icon"), created_by=user.id)
        db.add(role)
        db.commit()
        db.refresh(role)
        return role

    @staticmethod
    def update(db: Session, role_id: int, data: dict, user):
        role = db.get(Role, role_id)
        if not role:
            return None
        role.name = data["name"]
        role.icon = data.get("icon", role.icon)
        role.updated_at = datetime.utcnow()
        role.updated_by = user.id
        db.commit()
        return role

    @staticmethod
    def delete(db: Session, role_id: int, user):
        role = db.get(Role, role_id)
        if not role:
            return None
        if role.is_default:
            return None # Or raise an error
        role.is_active = False
        role.updated_at = datetime.utcnow()
        role.updated_by = user.id
        db.commit()
        return role
