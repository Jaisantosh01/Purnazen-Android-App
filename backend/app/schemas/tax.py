from pydantic import BaseModel, ConfigDict, Field


class TaxConfigUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # 0 is allowed and means "no GST" — that is how tax is switched off, so
    # there is no separate enabled flag to keep in sync with the rate.
    gst_percentage: float = Field(alias="gstPercentage", ge=0, le=100)
