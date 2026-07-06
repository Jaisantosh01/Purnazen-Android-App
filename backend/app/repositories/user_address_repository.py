import uuid

from sqlalchemy.orm import Session

from app.models.user_address import UserAddress


class UserAddressRepository:

    @staticmethod
    def create(db: Session, user_id: uuid.UUID, data: dict) -> UserAddress:
        address = UserAddress(
            **data,
            user_id=user_id,
            created_by=user_id,
            updated_by=user_id,
        )
        db.add(address)
        db.commit()
        db.refresh(address)
        return address

    @staticmethod
    def get_by_id(db: Session, address_id: uuid.UUID) -> UserAddress | None:
        return db.query(UserAddress).filter(UserAddress.id == address_id).first()

    @staticmethod
    def get_user_addresses(db: Session, user_id: uuid.UUID) -> list[UserAddress]:
        return (
            db.query(UserAddress)
            .filter(UserAddress.user_id == user_id, UserAddress.is_active == True)
            .order_by(UserAddress.is_default.desc(), UserAddress.created_at.desc())
            .all()
        )

    @staticmethod
    def update(db: Session, address_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> UserAddress | None:
        address = UserAddressRepository.get_by_id(db, address_id)
        if not address or address.user_id != user_id:
            return None
        for key, value in data.items():
            setattr(address, key, value)
        address.updated_by = user_id
        db.commit()
        db.refresh(address)
        return address

    @staticmethod
    def soft_delete(db: Session, address_id: uuid.UUID, user_id: uuid.UUID) -> UserAddress | None:
        address = UserAddressRepository.get_by_id(db, address_id)
        if not address or address.user_id != user_id:
            return None
        address.is_active = False
        address.updated_by = user_id
        db.commit()
        db.refresh(address)
        return address
