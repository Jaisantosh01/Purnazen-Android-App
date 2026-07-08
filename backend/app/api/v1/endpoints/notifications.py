import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    BroadcastRequest,
    NotificationSettingsUpdate,
    RegisterDeviceTokenRequest,
    RemoveDeviceTokenRequest,
)
from app.services.notification_service import NotificationService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ─────────────────────────────────────────────────────────────────────────────
# Static paths MUST be declared before "/{notification_id}" (FastAPI matches
# routes in declaration order — see doctor_leaves.py for the war story).
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "",
    summary="List my notifications",
    description="Newest first, with the recipient's unread count.",
)
def list_notifications(
    unread_only: bool = Query(False, alias="unreadOnly"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)  # noqa: E712
    total = query.count()
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
        .count()
    )
    rows = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    return success_response(
        "Notifications fetched",
        {
            "notifications": [n.to_dict() for n in rows],
            "total": total,
            "unreadCount": unread,
        },
    )


@router.post("/read-all", summary="Mark all my notifications as read")
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
        .update({Notification.is_read: True}, synchronize_session=False)
    )
    db.commit()
    return success_response("All notifications marked read", {"updated": updated})


@router.post(
    "/device-tokens",
    summary="Register this device for push notifications",
    description="Upserts the FCM registration token for the logged-in user.",
)
def register_device_token(
    body: RegisterDeviceTokenRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    NotificationService.register_token(db, user, body.token, body.platform, body.app)
    return success_response("Device registered for push notifications")


@router.post(
    "/device-tokens/remove",
    summary="Unregister a device token (logout)",
)
def remove_device_token(
    body: RemoveDeviceTokenRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    NotificationService.remove_token(db, body.token)
    return success_response("Device token removed")


# ── Admin control ────────────────────────────────────────────────────────────


@router.get("/admin/settings", summary="Global notification switches (admin)")
def get_admin_settings(
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    row = NotificationService.get_settings(db)
    return success_response("Notification settings fetched", row.to_dict())


@router.put("/admin/settings", summary="Update global notification switches (admin)")
def update_admin_settings(
    body: NotificationSettingsUpdate,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    row = NotificationService.get_settings(db)
    for field in (
        "appointments_enabled",
        "payments_enabled",
        "promos_enabled",
        "reminders_enabled",
        "reminder_lead_minutes",
    ):
        value = getattr(body, field)
        if value is not None:
            setattr(row, field, value)
    row.updated_by = user.id
    db.commit()
    db.refresh(row)
    return success_response("Notification settings updated", row.to_dict())


@router.post(
    "/admin/broadcast",
    summary="Broadcast a promotional / important notification (admin)",
    description=(
        "Sends to every active user in the audience (all | users | doctors). "
        "Promotional broadcasts respect each user's offers opt-out; system "
        "broadcasts ignore user toggles."
    ),
)
def broadcast(
    body: BroadcastRequest,
    user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    count = NotificationService.broadcast(
        db,
        audience=body.audience,
        category=body.category,
        event="admin_broadcast",
        title=body.title,
        body=body.body,
        data={"sentBy": str(user.id)},
    )
    return success_response(
        f"Broadcast delivered to {count} recipient(s)", {"recipients": count}
    )


# ── Parameterized routes LAST ────────────────────────────────────────────────


@router.patch("/{notification_id}/read", summary="Mark one notification as read")
def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        return error_response("Notification not found", 404)
    n.is_read = True
    db.commit()
    return success_response("Notification marked read", n.to_dict())


@router.delete("/{notification_id}", summary="Delete one of my notifications")
def delete_notification(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        return error_response("Notification not found", 404)
    db.delete(n)
    db.commit()
    return success_response("Notification deleted")
