"""Reminder scheduler timezone correctness.

Appointment dates and slot start times are stored as bare wall-clock values in
the app timezone (Asia/Kolkata). The scheduler must anchor "now" to that zone;
otherwise reminders fire off by the server's UTC offset (~5.5h for IST on a UTC
container) for both the patient and the doctor.
"""
from datetime import datetime, time, timezone

import pytest

from app.models.appointment import Appointment
from app.models.notification import Notification
from app.services import reminder_scheduler
from app.services.reminder_scheduler import expire_stale_holds, send_due_reminders
from tests.test_appointments import auth_headers, book_payload, slot_at
from tests.test_doctors import add_availability, next_weekday, seed_doctor


def _book_0900_appointment(client, db_session):
    """Book a 09:00 (IST) appointment on the next Monday; return its date."""
    doctor = seed_doctor(db_session)
    slots = add_availability(
        db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0)
    )
    on_date = next_weekday("Monday")
    resp = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date, slot_at(slots, time(9, 0))),
        headers=auth_headers(client),
    )
    assert resp.status_code == 201
    return on_date


@pytest.fixture()
def scheduler_session(monkeypatch, db_session):
    """Run send_due_reminders against the test's in-memory session."""
    monkeypatch.setattr(db_session, "close", lambda: None)
    monkeypatch.setattr(reminder_scheduler, "SessionLocal", lambda: db_session)
    return db_session


def _reminder_count(db_session):
    return (
        db_session.query(Notification)
        .filter(Notification.category == "reminder")
        .count()
    )


def test_reminder_fires_at_ist_wallclock(client, db_session, scheduler_session):
    on_date = _book_0900_appointment(client, db_session)

    # Real instant 30 min before the 09:00 IST slot == 03:00 UTC. Passing an
    # aware UTC "now" also guards against the old naive/aware mismatch.
    now = datetime(on_date.year, on_date.month, on_date.day, 3, 0, tzinfo=timezone.utc)

    assert send_due_reminders(now=now) == 1
    # Both the patient and the doctor are reminded.
    assert _reminder_count(db_session) == 2
    assert db_session.query(Appointment).first().reminder_sent_at is not None


def test_reminder_not_sent_outside_window(client, db_session, scheduler_session):
    on_date = _book_0900_appointment(client, db_session)

    # 08:30 UTC == 14:00 IST — five hours past the 09:00 slot. This is roughly
    # when the old UTC-naive code misfired; nothing is due now.
    now = datetime(on_date.year, on_date.month, on_date.day, 8, 30, tzinfo=timezone.utc)

    assert send_due_reminders(now=now) == 0
    assert _reminder_count(db_session) == 0


def test_naive_now_is_treated_as_app_local(client, db_session, scheduler_session):
    on_date = _book_0900_appointment(client, db_session)

    # A naive "now" is interpreted as IST wall clock: 08:45 IST is in-window.
    now = datetime(on_date.year, on_date.month, on_date.day, 8, 45)

    assert send_due_reminders(now=now) == 1


def test_reminder_sent_exactly_once(client, db_session, scheduler_session):
    on_date = _book_0900_appointment(client, db_session)
    now = datetime(on_date.year, on_date.month, on_date.day, 3, 0, tzinfo=timezone.utc)

    assert send_due_reminders(now=now) == 1
    # A second tick inside the same window must not re-notify.
    assert send_due_reminders(now=now) == 0
    assert _reminder_count(db_session) == 2


def test_stale_unpaid_hold_is_released(client, db_session, scheduler_session):
    """An unpaid hold older than the TTL is cancelled, freeing the slot."""
    from datetime import timedelta

    _book_0900_appointment(client, db_session)
    appt = db_session.query(Appointment).first()
    assert appt.status == "pending" and appt.payment_status == "pending"

    # Age the hold past the TTL by backdating created_at.
    appt.created_at = datetime.utcnow() - timedelta(hours=1)
    db_session.commit()

    assert expire_stale_holds() == 1
    db_session.refresh(appt)
    assert appt.status == "cancelled"


def test_fresh_and_paid_holds_are_kept(client, db_session, scheduler_session):
    """A just-created hold (within TTL) and a paid booking are never released."""
    _book_0900_appointment(client, db_session)
    appt = db_session.query(Appointment).first()

    # Fresh hold — inside the TTL window.
    assert expire_stale_holds() == 0
    db_session.refresh(appt)
    assert appt.status == "pending"

    # Paid booking, even if old, is not a hold and must be kept.
    from datetime import timedelta
    appt.payment_status = "paid"
    appt.status = "booked"
    appt.created_at = datetime.utcnow() - timedelta(hours=2)
    db_session.commit()
    assert expire_stale_holds() == 0
    db_session.refresh(appt)
    assert appt.status == "booked"
