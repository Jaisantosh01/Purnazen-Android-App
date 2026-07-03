import uuid

from sqlalchemy.orm import Session

from app.repositories.user_address_repository import UserAddressRepository
from app.schemas.user_address import CreateUserAddressRequest, UpdateUserAddressRequest


class UserAddressService:

    @staticmethod
    def create(db: Session, user_id: uuid.UUID, data: CreateUserAddressRequest):
        address_data = data.model_dump(exclude_unset=True)
        address = UserAddressRepository.create(db, user_id, address_data)
        return address.to_dict()

    @staticmethod
    def get_user_addresses(db: Session, user_id: uuid.UUID) -> list[dict]:
        addresses = UserAddressRepository.get_user_addresses(db, user_id)
        return [a.to_dict() for a in addresses]

    @staticmethod
    def update(db: Session, address_id: uuid.UUID, user_id: uuid.UUID, data: UpdateUserAddressRequest):
        update_data = data.model_dump(exclude_unset=True)
        address = UserAddressRepository.update(db, address_id, user_id, update_data)
        if not address:
            return None
        return address.to_dict()

    @staticmethod
    def soft_delete(db: Session, address_id: uuid.UUID, user_id: uuid.UUID):
        address = UserAddressRepository.soft_delete(db, address_id, user_id)
        if not address:
            return None
        return address.to_dict()
