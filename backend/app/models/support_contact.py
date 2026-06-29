import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from app.db.types import GUID

from app.db.base_class import Base


class SupportContact(Base):
    """Admin-configurable Help & Support contact channel (chat, email, phone…).

    The app renders these instead of hardcoded placeholders; ``contact_type``
    drives the tap action on the client (email → mailto, phone → tel, etc.).
    """

    __tablename__ = "support_contacts"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4, nullable=False)
    # 'chat' | 'email' | 'phone' | 'whatsapp' | 'other'
    contact_type = Column(String(20), nullable=False)
    title = Column(String(100), nullable=False)
    subtitle = Column(String(150), nullable=True)
    # The actionable value: an email address, phone number, or URL. May be null
    # for channels (e.g. live chat) that aren't wired up yet.
    value = Column(String(255), nullable=True)
    icon = Column(String(60), nullable=True)
    color = Column(String(20), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    created_by = Column(GUID(), ForeignKey("users.id"), nullable=True)
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.contact_type,
            "title": self.title,
            "subtitle": self.subtitle,
            "value": self.value,
            "icon": self.icon,
            "color": self.color,
            "sortOrder": self.sort_order,
        }
