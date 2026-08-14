from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.tax import TaxConfigUpdate
from app.services.tax_service import TaxService
from app.utils.responses import success_response

router = APIRouter(prefix="/tax", tags=["Tax"])


@router.get(
    "/config",
    summary="Current tax configuration",
    description=(
        "Returns the GST percentage the apps must use when quoting a fee that "
        "has no appointment yet (doctor profile, booking summary). Once an "
        "appointment exists, use the rate snapshotted on it instead."
    ),
)
def get_tax_config(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response("Tax configuration fetched", TaxService.get_settings(db).to_dict())


@router.put(
    "/config",
    summary="Update tax configuration (admin)",
    description=(
        "Sets the GST percentage applied to new bookings. Appointments already "
        "booked keep the rate they were quoted at."
    ),
)
def update_tax_config(
    body: TaxConfigUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    row = TaxService.get_settings(db)
    row.gst_percentage = body.gst_percentage
    row.updated_by = user.id
    db.commit()
    db.refresh(row)
    return success_response("Tax configuration updated", row.to_dict())
