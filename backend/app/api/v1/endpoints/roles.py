import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_role
from app.services.role_service import RoleService
from app.utils.responses import success_response, error_response
from app.models.user import User

router = APIRouter(prefix="/roles", tags=["Roles"])

@router.get("", summary="Get all active roles")
def get_all_roles(db: Session = Depends(get_db)):
    roles = RoleService.get_all(db, include_inactive=True)
    return success_response("Roles fetched successfully", [r.to_dict() for r in roles])

@router.post("", summary="Create a new role", dependencies=[Depends(require_role("admin"))])
def create_role(data: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return success_response("Role created successfully", RoleService.create(db, data, user).to_dict())

@router.put("/{role_id}", summary="Update a role", dependencies=[Depends(require_role("admin"))])
def update_role(role_id: uuid.UUID, data: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role = RoleService.update(db, role_id, data, user)
    if not role:
        return error_response("Role not found", 404)
    return success_response("Role updated successfully", role.to_dict())

@router.delete("/{role_id}", summary="Delete a role", dependencies=[Depends(require_role("admin"))])
def delete_role(role_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    role = RoleService.delete(db, role_id, user)
    if role is None:
        # Need to check if role exists but was default, or simply not found
        # Simplified for now assuming RoleService.delete returns None if not found OR forbidden
        from app.models.role import Role
        existing_role = db.get(Role, role_id)
        if existing_role and existing_role.is_default:
            return error_response("Cannot delete a default role", 403)
        return error_response("Role not found", 404)
    return success_response("Role deleted successfully", {})
