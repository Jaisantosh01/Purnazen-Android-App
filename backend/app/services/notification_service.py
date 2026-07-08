"""Central notification pipeline.

Every notification flows through ``NotificationService.notify``:

    global admin switch (notification_settings)
      → user preference (user_preferences.push_enabled + notifications JSON)
        → in-app row (notifications table)
        → device push (FCM, all registered tokens of the recipient)

Delivery rules:
  * Transactional categories (appointment / payment / reminder / system) always
    create the in-app row; user preferences only mute the device push.
  * Promotional ("promo") notifications respect the user's opt-out fully —
    neither a row nor a push is created when the user disabled offers.
  * A disabled global admin switch drops the notification entirely.

All hooks call this best-effort: a notification failure must never break the
business action that triggered it, so callers wrap with try/except (see
``notify_safely``).
"""

import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.device_token import DeviceToken
from app.models.notification import Notification
from app.models.notification_setting import NotificationSetting
from app.models.user import User
from app.models.user_preference import UserPreference
from app.services import fcm_service

logger = logging.getLogger(__name__)

# category → global admin switch attribute
_GLOBAL_SWITCH = {
    "appointment": "appointments_enabled",
    "payment": "payments_enabled",
    "promo": "promos_enabled",
    "reminder": "reminders_enabled",
    # "system" has no switch — always on
}

# category → user preference toggle key (mobile NotificationsScreen ids)
_PREF_KEY = {
    "appointment": "appointment",
    "payment": "payment",
    "promo": "offers",
    "reminder": "appointment",
    # "system" ignores user toggles
}


class NotificationService:

    # ── settings ────────────────────────────────────────────────────────────

    @staticmethod
    def get_settings(db: Session) -> NotificationSetting:
        row = db.get(NotificationSetting, 1)
        if row is None:
            row = NotificationSetting(id=1)
            db.add(row)
            db.commit()
            db.refresh(row)
        return row

    # ── preference resolution ────────────────────────────────────────────────

    @staticmethod
    def _user_allows_push(db: Session, user_id, category: str) -> bool:
        pref = db.query(UserPreference).filter(UserPreference.user_id == user_id).first()
        if pref is None:
            # No prefs row yet: default everything on except promos opt-in
            return category != "promo"
        if not pref.push_enabled:
            return False
        key = _PREF_KEY.get(category)
        if key is None:  # system
            return True
        toggles = pref.notifications or {}
        default = category != "promo"  # offers default OFF, rest default ON
        return bool(toggles.get(key, default))

    # ── core ────────────────────────────────────────────────────────────────

    @staticmethod
    def notify(
        db: Session,
        user_id,
        category: str,
        event: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> Optional[Notification]:
        """Create an in-app notification (+ push) for one recipient.

        Commits its own transaction; call AFTER the triggering business action
        has committed.
        """
        settings_row = NotificationService.get_settings(db)
        switch = _GLOBAL_SWITCH.get(category)
        if switch and not getattr(settings_row, switch):
            return None

        allows_push = NotificationService._user_allows_push(db, user_id, category)
        if category == "promo" and not allows_push:
            return None  # full opt-out for promotional content

        notification = Notification(
            user_id=user_id,
            category=category,
            event=event,
            title=title,
            body=body,
            data=data or {},
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        if allows_push:
            NotificationService._push_to_user(db, user_id, title, body, {
                "category": category,
                "event": event,
                **{k: str(v) for k, v in (data or {}).items()},
            })

        return notification

    @staticmethod
    def notify_safely(db: Session, *args, **kwargs) -> None:
        """notify() variant that never raises — for business-logic hooks."""
        try:
            NotificationService.notify(db, *args, **kwargs)
        except Exception as exc:
            logger.warning("Notification dispatch failed: %s", exc)
            try:
                db.rollback()
            except Exception:
                pass

    @staticmethod
    def _push_to_user(db: Session, user_id, title: str, body: str, data: dict) -> None:
        if not fcm_service.is_enabled():
            return
        tokens = db.query(DeviceToken).filter(DeviceToken.user_id == user_id).all()
        dead = []
        for t in tokens:
            if not fcm_service.send_to_token(t.token, title, body, data):
                dead.append(t)
        for t in dead:
            db.delete(t)
        if dead:
            db.commit()

    # ── device tokens ───────────────────────────────────────────────────────

    @staticmethod
    def register_token(db: Session, user: User, token: str, platform: str, app: str) -> None:
        existing = db.query(DeviceToken).filter(DeviceToken.token == token).first()
        if existing:
            existing.user_id = user.id
            existing.platform = platform
            existing.app = app
        else:
            db.add(DeviceToken(user_id=user.id, token=token, platform=platform, app=app))
        db.commit()

    @staticmethod
    def remove_token(db: Session, token: str) -> None:
        db.query(DeviceToken).filter(DeviceToken.token == token).delete()
        db.commit()

    # ── broadcast (admin) ───────────────────────────────────────────────────

    @staticmethod
    def broadcast(
        db: Session,
        audience: str,  # all | users | doctors
        category: str,  # promo | system
        event: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
    ) -> int:
        """Fan a notification out to every active user in the audience.

        Returns the number of recipients that actually received it (after
        preference filtering).
        """
        from app.models.doctor import Doctor

        query = db.query(User.id).filter(User.is_active == True)  # noqa: E712
        doctor_user_ids = {row[0] for row in db.query(Doctor.user_id).all()}
        if audience == "doctors":
            query = query.filter(User.id.in_(doctor_user_ids))
        elif audience == "users":
            if doctor_user_ids:
                query = query.filter(~User.id.in_(doctor_user_ids))

        count = 0
        for (uid,) in query.all():
            if NotificationService.notify(db, uid, category, event, title, body, data):
                count += 1
        return count
