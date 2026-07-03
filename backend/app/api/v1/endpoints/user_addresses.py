import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.user_address import CreateUserAddressRequest, UpdateUserAddressRequest
from app.services.user_address_service import UserAddressService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/user-addresses", tags=["User Addresses"])


@router.post(
    "",
    status_code=201,
    summary="Create a user address",
    description="Creates a new address for the authenticated user.",
)
def create_address(
    body: CreateUserAddressRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = UserAddressService.create(db, user.id, body)
    return success_response("Address created successfully", result, 201)


@router.get(
    "",
    summary="List user addresses",
    description="Returns all active addresses for the authenticated user, ordered by default first then newest.",
)
def list_addresses(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = UserAddressService.get_user_addresses(db, user.id)
    return success_response("Addresses fetched successfully", {"addresses": result})


@router.put(
    "/{address_id}",
    summary="Update a user address",
    description="Updates an existing address. Only the owner can update. Returns 404 if not found.",
)
def update_address(
    address_id: uuid.UUID,
    body: UpdateUserAddressRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = UserAddressService.update(db, address_id, user.id, body)
    if result is None:
        return error_response("Address not found", 404)
    return success_response("Address updated successfully", result)


@router.delete(
    "/{address_id}",
    summary="Delete a user address (soft)",
    description="Soft-deletes an address by setting `is_active = false`. Only the owner can delete.",
)
def delete_address(
    address_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = UserAddressService.soft_delete(db, address_id, user.id)
    if result is None:
        return error_response("Address not found", 404)
    return success_response("Address deleted successfully", result)
