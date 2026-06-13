from pydantic import BaseModel, ConfigDict, Field


class UpdatePreferencesRequest(BaseModel):
    """Partial update: omitted fields keep their stored values; the
    notifications dict is merged key-by-key, not replaced."""

    model_config = ConfigDict(populate_by_name=True)

    push_enabled: bool | None = Field(default=None, alias="pushEnabled")
    notifications: dict[str, bool] | None = None
