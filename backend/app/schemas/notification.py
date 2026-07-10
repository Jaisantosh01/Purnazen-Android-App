from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class RegisterDeviceTokenRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    token: str = Field(min_length=10, max_length=512)
    platform: Literal["android", "ios"] = "android"
    app: Literal["users", "doctors", "admin"] = "users"


class RemoveDeviceTokenRequest(BaseModel):
    token: str = Field(min_length=10, max_length=512)


class NotificationSettingsUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    appointments_enabled: Optional[bool] = Field(alias="appointmentsEnabled", default=None)
    payments_enabled: Optional[bool] = Field(alias="paymentsEnabled", default=None)
    promos_enabled: Optional[bool] = Field(alias="promosEnabled", default=None)
    reminders_enabled: Optional[bool] = Field(alias="remindersEnabled", default=None)
    reminder_lead_minutes: Optional[int] = Field(
        alias="reminderLeadMinutes", default=None, ge=5, le=24 * 60
    )


class BroadcastRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1, max_length=1000)
    audience: Literal["all", "users", "doctors"] = "all"
    category: Literal["promo", "system"] = "promo"
    # Personalized-offer targeting; {name} in title/body is replaced per recipient.
    segment: Literal["everyone", "new_users", "inactive_users"] = "everyone"
    # When set (future), the broadcast is stored and dispatched by the scheduler.
    scheduled_at: Optional[datetime] = Field(alias="scheduledAt", default=None)
