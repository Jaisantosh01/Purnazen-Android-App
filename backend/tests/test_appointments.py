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


def book_payload(doctor, on_date, slot="09:00 AM"):
    return {
        "doctorId": str(doctor.id),
        "visitType": "video",
        "date": on_date.isoformat(),
        "time": slot,
        "fee": 1200,
    }


def test_book_appointment_success(client, db_session):
    doctor = seed_doctor(db_session)
    add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    response = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date),
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True

    data = body["data"]
    assert data["reference"] == "APT-000001"
    assert data["status"] == "booked"
    assert data["date"] == on_date.isoformat()
    assert data["time"] == "09:00 AM"
    assert data["slotEnd"] == "09:30"
    assert data["visitType"] == "video"
    assert data["fee"] == 1200.0


def test_book_appointment_conflict(client, db_session):
    doctor = seed_doctor(db_session)
    add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    first = client.post(
        "/api/v1/appointments/book", json=book_payload(doctor, on_date), headers=headers
    )
    assert first.status_code == 201

    other_headers = auth_headers(client, email="second@example.com")
    second = client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date),
        headers=other_headers,
    )
    assert second.status_code == 409
    body = second.json()
    assert body["success"] is False
    assert "already booked" in body["message"]


def test_book_appointment_requires_auth(client, db_session):
    doctor = seed_doctor(db_session)
    response = client.post(
        "/api/v1/appointments/book", json=book_payload(doctor, next_weekday("Monday"))
    )
    assert response.status_code == 401
    assert response.json()["success"] is False


def test_book_appointment_unknown_doctor(client, db_session):
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/appointments/book",
        json={
            "doctorId": "999",
            "visitType": "video",
            "date": next_weekday("Monday").isoformat(),
            "time": "09:00 AM",
        },
        headers=headers,
    )
    assert response.status_code == 404
    assert response.json()["message"] == "Doctor not found"


def test_book_appointment_past_date(client, db_session):
    doctor = seed_doctor(db_session)
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/appointments/book",
        json={
            "doctorId": str(doctor.id),
            "visitType": "video",
            "date": "2020-01-01",
            "time": "09:00 AM",
        },
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "Date must not be in the past"


def test_book_appointment_invalid_time(client, db_session):
    doctor = seed_doctor(db_session)
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/appointments/book",
        json={
            "doctorId": str(doctor.id),
            "visitType": "video",
            "date": next_weekday("Monday").isoformat(),
            "time": "25:99",
        },
        headers=headers,
    )
    assert response.status_code == 400


def test_booked_slot_excluded_from_time_slots(client, db_session):
    doctor = seed_doctor(db_session)
    add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    client.post(
        "/api/v1/appointments/book",
        json=book_payload(doctor, on_date, slot="09:30 AM"),
        headers=headers,
    )

    response = client.get(
        f"/api/v1/doctors/{doctor.id}/time-slots",
        params={"date": on_date.isoformat()},
    )
    slots = response.json()["data"]["slots"]
    assert "09:30 AM" not in slots
    assert "09:00 AM" in slots


def test_get_appointments_lists_booking(client, db_session):
    doctor = seed_doctor(db_session)
    add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")
    headers = auth_headers(client)

    client.post(
        "/api/v1/appointments/book", json=book_payload(doctor, on_date), headers=headers
    )

    response = client.get("/api/v1/appointments", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1

    appointment = data["appointments"][0]
    assert appointment["doctorName"] == "Dr. Dr Sarah Chen"
    assert appointment["isUpcoming"] is True
    assert appointment["status"] == "booked"


def test_get_appointments_requires_auth(client):
    response = client.get("/api/v1/appointments")
    assert response.status_code == 401


def test_get_appointments_only_own(client, db_session):
    doctor = seed_doctor(db_session)
    add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")

    booker = auth_headers(client)
    client.post(
        "/api/v1/appointments/book", json=book_payload(doctor, on_date), headers=booker
    )

    other = auth_headers(client, email="other@example.com")
    response = client.get("/api/v1/appointments", headers=other)
    assert response.json()["data"]["total"] == 0
