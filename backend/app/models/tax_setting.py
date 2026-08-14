from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, func

from app.db.base_class import Base
from app.db.types import GUID


class TaxSetting(Base):
    """Global (admin-controlled) tax configuration — a single row (id=1).

    Only GST is charged today: one percentage applied to the consultation fee.
    Appointments snapshot the rate that applied when they were booked (see
    ``Appointment.gst_percentage``), so editing the rate here never rewrites the
    total of a booking that was already quoted to a patient.
    """

    __tablename__ = "tax_settings"

    id = Column(Integer, primary_key=True, default=1)
    gst_percentage = Column(
        Numeric(5, 2), nullable=False, default=18, server_default="18"
    )
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    updated_by = Column(GUID(), ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "gstPercentage": float(self.gst_percentage) if self.gst_percentage is not None else 0.0,
        }
