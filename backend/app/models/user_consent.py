import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from app.db.types import GUID
from sqlalchemy.orm import relationship

from app.db.base_class import Base

ALLOWED_CONSENT_TYPES = {"scan_storage", "ai_training", "gdpr_data"}


class UserConsent(Base):
    __tablename__ = "user_consents"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    consent_type = Column(String(50), nullable=False)
    granted = Column(Boolean, nullable=False, default=False)
    granted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    consent_version = Column(String(20), nullable=False, default="1.0")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="consents")

    def to_dict(self):
        return {
            "consentType": self.consent_type,
            "granted": self.granted,
            "grantedAt": self.granted_at.isoformat() if self.granted_at else None,
            "revokedAt": self.revoked_at.isoformat() if self.revoked_at else None,
            "consentVersion": self.consent_version,
        }
