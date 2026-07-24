"""Appointment reminder scheduler.

A lightweight asyncio loop (started from the FastAPI lifespan) that wakes every
minute and dispatches reminder notifications for appointments starting within
the configured lead window (notification_settings.reminder_lead_minutes,
admin-controlled). ``appointments.reminder_sent_at`` guarantees exactly-once
delivery across restarts.

No external scheduler dependency: the appointment volume is small and the
loop's work is one indexed query per minute.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.appointment import Appointment
from app.models.broadcast import Broadcast
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

_INTERVAL_SECONDS = 60


def send_due_reminders(now: datetime | None = None) -> int:
    """Send reminders for appointments starting within the lead window.

    Appointment dates and slot start times are stored as bare wall-clock values
    in the app timezone (``settings.APP_TIMEZONE``), so "now" is anchored to that
    zone before comparing. Otherwise reminders fire off by the server's UTC
    offset (~5.5h for IST on a UTC container) for both patient and doctor.

    Returns the number of appointments reminded (for tests/logging).
    """
    tz = ZoneInfo(settings.APP_TIMEZONE)
    if now is None:
        now = datetime.now(tz)
    elif now.tzinfo is None:
        # A naive caller-supplied time is taken as app-local wall clock.
        now = now.replace(tzinfo=tz)
    else:
        now = now.astimezone(tz)
    db = SessionLocal()
    try:
        settings_row = NotificationService.get_settings(db)
        if not settings_row.reminders_enabled:
            return 0
        lead = timedelta(minutes=settings_row.reminder_lead_minutes)

        candidates = (
            db.query(Appointment)
            .filter(
                Appointment.status.in_(["pending", "booked"]),
                Appointment.reminder_sent_at.is_(None),
                Appointment.is_active == True,  # noqa: E712
                Appointment.date.in_([now.date(), (now + lead).date()]),
            )
            .all()
        )

        reminded = 0
        for appointment in candidates:
            slot = appointment.slot_timing
            if not slot or not slot.start_time:
                continue
            start_dt = datetime.combine(appointment.date, slot.start_time, tzinfo=tz)
            if not (now <= start_dt <= now + lead):
                continue

            time_str = slot.start_time.strftime("%I:%M %p")
            minutes_left = max(1, int((start_dt - now).total_seconds() // 60))
            payload = {"appointmentId": str(appointment.id)}

            doctor_name = (
                f"Dr. {appointment.doctor.user.full_name}"
                if appointment.doctor and appointment.doctor.user
                else "your doctor"
            )
            NotificationService.notify_safely(
                db, appointment.user_id, category="reminder",
                event="appointment_reminder",
                title="Upcoming appointment",
                body=f"{appointment.reference} with {doctor_name} starts at {time_str} (~{minutes_left} min).",
                data=payload,
            )
            if appointment.doctor:
                patient = appointment.user.full_name if appointment.user else "a patient"
                NotificationService.notify_safely(
                    db, appointment.doctor.user_id, category="reminder",
                    event="appointment_reminder",
                    title="Upcoming appointment",
                    body=f"{appointment.reference} with {patient} starts at {time_str} (~{minutes_left} min).",
                    data=payload,
                )

            appointment.reminder_sent_at = now.astimezone(timezone.utc).replace(tzinfo=None)
            db.commit()
            reminded += 1

        return reminded
    finally:
        db.close()


def send_due_broadcasts(now: datetime | None = None) -> int:
    """Dispatch admin broadcasts whose scheduled time has arrived.

    Returns the number of broadcasts sent (for tests/logging).
    """
    now = now or datetime.now()
    db = SessionLocal()
    try:
        due = (
            db.query(Broadcast)
            .filter(Broadcast.status == "scheduled", Broadcast.scheduled_at <= now)
            .order_by(Broadcast.scheduled_at)
            .all()
        )
        for row in due:
            try:
                count = NotificationService.send_broadcast(db, row)
                logger.info(
                    "Scheduled broadcast %s sent to %s recipient(s).", row.id, count
                )
            except Exception as exc:
                logger.warning("Scheduled broadcast %s failed: %s", row.id, exc)
                db.rollback()
        return len(due)
    finally:
        db.close()


def expire_stale_holds(now: datetime | None = None) -> int:
    """Release unpaid booking holds older than ``UNPAID_HOLD_TTL_MINUTES``.

    A booking is created as ``status=pending, payment_status=pending`` — a *hold*
    on the slot until payment completes. If the user abandons payment the hold
    lingers and ``slot_taken`` keeps that slot blocked for *every* user (a
    different user is never excluded, unlike the booker's own retry). This sweep
    cancels holds whose ``created_at`` is older than the TTL, freeing the slot.

    ``created_at`` is a real server timestamp (UTC on our containers), so this
    compares against real elapsed time — unlike the wall-clock appointment date.
    Returns the number of holds released (for tests/logging).
    """
    ttl = timedelta(minutes=settings.UNPAID_HOLD_TTL_MINUTES)
    if now is None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
    elif now.tzinfo is not None:
        now = now.astimezone(timezone.utc).replace(tzinfo=None)
    cutoff = now - ttl

    db = SessionLocal()
    try:
        stale = (
            db.query(Appointment)
            .filter(
                Appointment.status == "pending",
                Appointment.payment_status == "pending",
                Appointment.is_active == True,  # noqa: E712
                Appointment.created_at < cutoff,
            )
            .all()
        )
        for appointment in stale:
            appointment.status = "cancelled"
            NotificationService.notify_safely(
                db, appointment.user_id, category="reminder",
                event="hold_expired",
                title="Booking hold released",
                body=(
                    f"{appointment.reference} was not paid in time, so the slot "
                    "has been released. You can book again anytime."
                ),
                data={"appointmentId": str(appointment.id)},
            )
        if stale:
            db.commit()
        return len(stale)
    finally:
        db.close()


async def reminder_loop() -> None:
    logger.info("Appointment reminder scheduler started (every %ss).", _INTERVAL_SECONDS)
    while True:
        try:
            count = await asyncio.to_thread(send_due_reminders)
            if count:
                logger.info("Dispatched %s appointment reminder(s).", count)
        except Exception as exc:
            logger.warning("Reminder scheduler tick failed: %s", exc)
        try:
            await asyncio.to_thread(send_due_broadcasts)
        except Exception as exc:
            logger.warning("Broadcast scheduler tick failed: %s", exc)
        try:
            released = await asyncio.to_thread(expire_stale_holds)
            if released:
                logger.info("Released %s stale unpaid booking hold(s).", released)
        except Exception as exc:
            logger.warning("Hold-expiry scheduler tick failed: %s", exc)
        await asyncio.sleep(_INTERVAL_SECONDS)
