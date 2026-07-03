import uuid
from datetime import time

from tests.test_doctors import add_availability, next_weekday, seed_doctor

REGISTER_PAYLOAD = {
    "full_name": "Test Patient",
    "email": "patient@example.com",
    "password": "secret123",
}


def auth_headers(client, email="patient@example.com"):
    client.post("/api/v1/auth/register", json={**REGISTER_PAYLOAD, "email": email})
    tokens = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secret123"}
    ).json()["data"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def slot_at(slots, when):
    """Return the seeded SlotTimings whose start time matches ``when``."""
    for slot in slots:
        if slot.start_time == when:
            return slot
    raise AssertionError(f"No seeded slot starting at {when}")


def book_payload(doctor, on_date, slot, visit_type="video", fee=1200):
    return {
        "doctorId": str(doctor.id),
        "visitType": visit_type,
        "date": on_date.isoformat(),
        "slotTimingId": str(slot.id),
        "fee": fee,
    }


def test_book_appointment_success(client, db_session):
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    response = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date, slot_at(slots, time(9, 0))),
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True

    data = body["data"]
    assert data["reference"].startswith("APT-")
    assert data["status"] == "pending"
    assert data["date"] == on_date.isoformat()
    assert data["time"] == "09:00 AM"
    assert data["endTime"] == "09:30 AM"
    # consultationType is the human-readable consultation type NAME (shown in the
    # app's appointment list/detail), resolved from the "video" visit-type slug.
    assert data["consultationType"] == "Video Call"
    assert data["fee"] == 1200.0


def test_book_appointment_conflict(client, db_session):
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    slot = slot_at(slots, time(9, 0))
    headers = auth_headers(client)

    first = client.post(
        "/api/v1/appointments/book", json=book_payload(doctor, on_date, slot), headers=headers
    )
    assert first.status_code == 201

    other_headers = auth_headers(client, email="second@example.com")
    second = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date, slot),
        headers=other_headers,
    )
    assert second.status_code == 409
    body = second.json()
    assert body["success"] is False
    assert "already booked" in body["message"]


def test_book_appointment_requires_auth(client, db_session):
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    response = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, next_weekday("Monday"), slot_at(slots, time(9, 0))),
    )
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_book_appointment_unknown_doctor(client, db_session):
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/appointments/book",
        json={
            "doctorId": str(uuid.uuid4()),
            "visitType": "video",
            "date": next_weekday("Monday").isoformat(),
            "slotTimingId": str(uuid.uuid4()),
        },
        headers=headers,
    )
    assert response.status_code == 404
    assert response.json()["message"] == "Doctor not found"


def test_book_appointment_past_date(client, db_session):
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, next_weekday("Monday").replace(year=2020), slot_at(slots, time(9, 0))),
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "Date must not be in the past"


def test_book_appointment_invalid_slot_id(client, db_session):
    doctor = seed_doctor(db_session)
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/appointments/book",
        json={
            "doctorId": str(doctor.id),
            "visitType": "video",
            "date": next_weekday("Monday").isoformat(),
            "slotTimingId": "not-a-uuid",
        },
        headers=headers,
    )
    assert response.status_code == 400


def test_booked_slot_marked_in_time_slots(client, db_session):
    """A booked slot is still returned but with ``booked: true``."""
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date, slot_at(slots, time(9, 30))),
        headers=headers,
    )

    response = client.get(
        f"/api/v1/doctors/{doctor.id}/time-slots",
        params={"date": on_date.isoformat()},
    )
    slots_resp = response.json()["data"]["slots"]
    assert len(slots_resp) == 4  # all slots returned, none excluded

    booked = {s["time"] for s in slots_resp if s["booked"]}
    free = {s["time"] for s in slots_resp if not s["booked"]}

    assert "09:30 AM" in booked
    assert "09:00 AM" in free
    assert "10:00 AM" in free
    assert "10:30 AM" in free


def test_time_slots_all_booked_shows_all_booked_flag(client, db_session):
    """When every slot on a date is booked, all have ``booked: true``."""
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    for slot in slots:
        client.post(
            "/api/v1/appointments/book",
            json=book_payload(doctor, on_date, slot),
            headers=headers,
        )

    response = client.get(
        f"/api/v1/doctors/{doctor.id}/time-slots",
        params={"date": on_date.isoformat()},
    )
    slots_resp = response.json()["data"]["slots"]
    assert len(slots_resp) == 4
    assert all(s["booked"] for s in slots_resp)


def test_get_appointments_lists_booking(client, db_session):
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date, slot_at(slots, time(9, 0))),
        headers=headers,
    )

    response = client.get("/api/v1/appointments", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1

    appointment = data["appointments"][0]
    assert appointment["doctorName"] == "Dr. Dr Sarah Chen"
    assert appointment["isUpcoming"] is True
    assert appointment["status"] == "pending"


def test_get_appointments_requires_auth(client):
    response = client.get("/api/v1/appointments")
    assert response.status_code == 401


def test_get_appointments_only_own(client, db_session):
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")

    booker = auth_headers(client)
    client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date, slot_at(slots, time(9, 0))),
        headers=booker,
    )

    other = auth_headers(client, email="other@example.com")
    response = client.get("/api/v1/appointments", headers=other)
    assert response.json()["data"]["total"] == 0
