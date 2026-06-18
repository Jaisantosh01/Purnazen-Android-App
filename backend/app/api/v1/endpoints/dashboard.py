from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.user import User
from app.services.dashboard_service import DashboardService
from app.utils.responses import success_response

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


@router.get(
    "/stats",
    summary="Get admin dashboard statistics",
    description="Fetches counts for active doctors, scheduled appointments, today's appointments, and active users.",
)
def get_dashboard_stats(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    stats = DashboardService.get_stats(db)
    return success_response("Dashboard statistics fetched successfully", stats)


@router.get(
    "/doctors/stats",
    summary="Get doctor management statistics",
    description="Fetches counts for active and inactive doctors.",
)
def get_doctor_management_stats(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    stats = DashboardService.get_stats(db)
    return success_response(
        "Doctor management statistics fetched successfully",
        {
            "active_doctors": stats["total_active_doctors"],
            "inactive_doctors": stats["total_inactive_doctors"],
        }
    )
