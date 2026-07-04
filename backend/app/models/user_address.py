from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid

from app.db.base_class import Base


class UserAddress(Base):
    __tablename__ = "user_addresses"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    house_name = Column(String(255))
    area = Column(String(255))
    landmark = Column(String(255))
    pincode = Column(String(20))
    city = Column(String(100))
    state = Column(String(100))
    type_of_address = Column(String(50))
    latitude = Column(Float)
    longitude = Column(Float)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    creator = relationship("User", foreign_keys=[created_by])
    modifier = relationship("User", foreign_keys=[updated_by])

    def to_dict(self):
        return {
            "id": str(self.id),
            "userId": str(self.user_id) if self.user_id else None,
            "houseName": self.house_name,
            "area": self.area,
            "landmark": self.landmark,
            "pincode": self.pincode,
            "city": self.city,
            "state": self.state,
            "typeOfAddress": self.type_of_address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "isDefault": self.is_default,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
