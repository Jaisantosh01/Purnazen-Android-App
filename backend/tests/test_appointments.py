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
    assert data["meetingLink"] is None  # no Google credentials in test env


def test_video_booking_gracefully_skips_meet_link(client, db_session):
    """Video booking succeeds even when Google Meet is not configured."""
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    response = client.post(
        "/api/v1/appointments/book",
        json={**book_payload(doctor, on_date, slot_at(slots, time(9, 0)), visit_type="video"), "fee": 1000},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["meetingLink"] is None


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
    assert appointment["doctorName"] == "Dr. Sarah Chen"
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


# ── Appointment detail: shape + who may read it ──────────────────────────────


def doctor_headers(client, email="sarah@example.com"):
    tokens = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "123456"}
    ).json()["data"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def book_one(client, db_session, patient_email="patient@example.com"):
    """Seed a doctor + booked appointment; returns (doctor, appointment_id, patient_headers)."""
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    headers = auth_headers(client, email=patient_email)
    booked = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, next_weekday("Monday"), slot_at(slots, time(9, 0))),
        headers=headers,
    )
    return doctor, booked.json()["data"]["id"], headers


def test_appointment_detail_for_doctor_includes_patient_profile(client, db_session):
    """The doctor's detail view carries the same patient fields as the list.

    Regression: detail used to return the bare appointment dict, so the doctor
    app's patient card showed "Age N/A" / "N/A" the moment it refetched.
    """
    _, appointment_id, patient = book_one(client, db_session)
    client.put("/api/v1/auth/me", json={"gender": "Female", "dateOfBirth": "1990-05-04"}, headers=patient)

    response = client.get(f"/api/v1/appointments/{appointment_id}", headers=doctor_headers(client))
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["userGender"] == "Female"
    assert data["userAge"] is not None
    assert data["userDateOfBirth"] == "1990-05-04"
    assert data["previousVisitsCount"] == 0
    assert "userEmail" in data and "userPhone" in data


def test_appointment_detail_for_patient_is_readable(client, db_session):
    _, appointment_id, patient = book_one(client, db_session)
    response = client.get(f"/api/v1/appointments/{appointment_id}", headers=patient)
    assert response.status_code == 200
    assert response.json()["data"]["id"] == appointment_id


def test_appointment_detail_hidden_from_unrelated_user(client, db_session):
    _, appointment_id, _ = book_one(client, db_session)
    stranger = auth_headers(client, email="stranger@example.com")
    response = client.get(f"/api/v1/appointments/{appointment_id}", headers=stranger)
    assert response.status_code == 404


def test_appointment_update_rejected_for_unrelated_user(client, db_session):
    _, appointment_id, _ = book_one(client, db_session)
    stranger = auth_headers(client, email="stranger2@example.com")
    response = client.put(
        f"/api/v1/appointments/{appointment_id}",
        json={"status": "cancelled"},
        headers=stranger,
    )
    assert response.status_code == 404

    # ...and the appointment is untouched.
    detail = client.get(f"/api/v1/appointments/{appointment_id}", headers=doctor_headers(client))
    assert detail.json()["data"]["status"] == "pending"


def test_patient_cannot_mark_own_appointment_paid(client, db_session):
    _, appointment_id, patient = book_one(client, db_session)
    response = client.put(
        f"/api/v1/appointments/{appointment_id}",
        json={"paymentStatus": "paid"},
        headers=patient,
    )
    assert response.status_code == 403

    detail = client.get(f"/api/v1/appointments/{appointment_id}", headers=patient)
    assert detail.json()["data"]["paymentStatus"] == "pending"


def test_doctor_status_update_returns_enriched_shape(client, db_session):
    _, appointment_id, _ = book_one(client, db_session)
    response = client.put(
        f"/api/v1/appointments/{appointment_id}",
        json={"status": "booked"},
        headers=doctor_headers(client),
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "booked"
    assert "userAge" in data and "previousVisitsCount" in data
