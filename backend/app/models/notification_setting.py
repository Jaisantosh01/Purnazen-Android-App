from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, func

from app.db.base_class import Base
from app.db.types import GUID


class NotificationSetting(Base):
    """Global (admin-controlled) notification switches — a single row (id=1).

    Category switches kill delivery app-wide regardless of user preferences;
    ``reminder_lead_minutes`` controls how long before an appointment the
    reminder fires.
    """

    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, default=1)
    appointments_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    payments_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    promos_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    reminders_enabled = Column(Boolean, nullable=False, default=True, server_default="true")
    reminder_lead_minutes = Column(Integer, nullable=False, default=60, server_default="60")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "appointmentsEnabled": bool(self.appointments_enabled),
            "paymentsEnabled": bool(self.payments_enabled),
            "promosEnabled": bool(self.promos_enabled),
            "remindersEnabled": bool(self.reminders_enabled),
            "reminderLeadMinutes": self.reminder_lead_minutes,
        }
