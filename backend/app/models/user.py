from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship
from app.db.types import GUID
import uuid
from datetime import date

from app.db.base_class import Base


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    full_name = Column(String(100), nullable=False)
    avatar_url = Column(String(500))
    email = Column(String(120), unique=True, nullable=False)
    password = Column(String(255), nullable=False)

    # Profile fields (optional — populated by patient or admin)
    gender = Column(String(10), nullable=True)       # Male | Female | Other
    phone = Column(String(15), nullable=True)
    date_of_birth = Column(Date, nullable=True)

    # Social sign-in provider the account was created/linked through
    # (google | github); null for password-only accounts. Informational —
    # login always re-verifies with the provider.
    auth_provider = Column(String(20), nullable=True)
    # Firebase Auth UID of the linked social identity. Lets a user (any role)
    # sign in with a social account whose email differs from the account email.
    firebase_uid = Column(String(128), unique=True, nullable=True)

    role_id = Column(GUID(), ForeignKey("roles.id"))

    token_version = Column(Integer, nullable=False, default=0, server_default="0")

    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    is_active = Column(Boolean, default=True, server_default="true")

    role = relationship("Role", foreign_keys=[role_id])

    @property
    def age(self):
        """Calculate age dynamically from date_of_birth."""
        if not self.date_of_birth:
            return None
        today = date.today()
        born = self.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "avatar_url": self.avatar_url,
            "email": self.email,
            "phone": self.phone,
            "gender": self.gender,
            "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
            "age": self.age,
            "auth_provider": self.auth_provider,
            "social_linked": bool(self.firebase_uid),
            "role_id": self.role_id,
            "role": self.role.name if self.role else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<User {self.email}>"