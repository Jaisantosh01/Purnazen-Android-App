import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from app.db.base_class import Base
from app.db.types import GUID


class DeviceToken(Base):
    """FCM registration token for one installed app on one device.

    A token is unique across the table; re-registering an existing token for a
    different user (e.g. logout → login as someone else on the same phone)
    re-assigns it. Tokens that FCM reports as unregistered are deleted by the
    push sender.
    """

    __tablename__ = "device_tokens"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(512), nullable=False, unique=True)
    platform = Column(String(10), nullable=False, default="android")  # android | ios
    app = Column(String(10), nullable=False, default="users")  # users | doctors | admin
    created_at = Column(DateTime, server_default=func.now())
    last_seen_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])
