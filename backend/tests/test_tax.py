"""Admin-configured GST: the config endpoints, the snapshot taken at booking
time, and the guarantee that checkout charges exactly what was quoted."""
from datetime import time

from app.models.role import Role
from app.models.user import User
from tests.test_doctors import add_availability, next_weekday, seed_doctor


def register_and_login(client, email, password="secret123"):
    client.post(
        "/api/v1/auth/register",
        json={"full_name": "Tax Tester", "email": email, "password": password},
    )
    data = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    ).json()["data"]
    return {"Authorization": f"Bearer {data['access_token']}"}


def make_admin(db_session, email):
    admin_role = db_session.query(Role).filter(Role.name == "admin").first()
    user = db_session.query(User).filter(User.email == email).first()
    user.role_id = admin_role.id
    db_session.commit()


def admin_headers(client, db_session, email="taxadmin@example.com"):
    headers = register_and_login(client, email)
    make_admin(db_session, email)
    return headers


def book(client, db_session, headers, fee=1200):
    doctor = seed_doctor(db_session)
    slots = add_availability(
        db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0)
    )
    response = client.post(
        "/api/v1/appointments/book",
        json={
            "doctorId": str(doctor.id),
            "visitType": "video",
            "date": next_weekday("Monday").isoformat(),
            "slotTimingId": str(slots[0].id),
            "fee": fee,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["data"]


# ── Config endpoints ─────────────────────────────────────────────────────────


def test_config_defaults_to_18_percent(client):
    headers = register_and_login(client, "reader@example.com")
    response = client.get("/api/v1/tax/config", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["gstPercentage"] == 18.0


def test_admin_can_update_the_rate(client, db_session):
    headers = admin_headers(client, db_session)

    response = client.put(
        "/api/v1/tax/config", json={"gstPercentage": 5}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["data"]["gstPercentage"] == 5.0

    # And it sticks for everyone reading the config back
    patient = register_and_login(client, "patient@example.com")
    assert client.get("/api/v1/tax/config", headers=patient).json()["data"][
        "gstPercentage"
    ] == 5.0


def test_zero_is_a_valid_rate(client, db_session):
    headers = admin_headers(client, db_session)
    response = client.put(
        "/api/v1/tax/config", json={"gstPercentage": 0}, headers=headers
    )
    assert response.status_code == 200
    assert response.json()["data"]["gstPercentage"] == 0.0


def test_rate_must_be_a_percentage(client, db_session):
    # The app maps RequestValidationError to a 400 envelope (see main.py).
    headers = admin_headers(client, db_session)
    assert (
        client.put(
            "/api/v1/tax/config", json={"gstPercentage": 101}, headers=headers
        ).status_code
        == 400
    )
    assert (
        client.put(
            "/api/v1/tax/config", json={"gstPercentage": -1}, headers=headers
        ).status_code
        == 400
    )


def test_non_admin_cannot_change_the_rate(client):
    headers = register_and_login(client, "notadmin@example.com")
    response = client.put(
        "/api/v1/tax/config", json={"gstPercentage": 0}, headers=headers
    )
    assert response.status_code == 403


def test_config_requires_auth(client):
    assert client.get("/api/v1/tax/config").status_code == 401
    assert client.put("/api/v1/tax/config", json={"gstPercentage": 5}).status_code == 401


# ── Booking snapshot ─────────────────────────────────────────────────────────


def test_booking_snapshots_the_configured_rate(client, db_session):
    admin = admin_headers(client, db_session)
    client.put("/api/v1/tax/config", json={"gstPercentage": 12}, headers=admin)

    headers = register_and_login(client, "booker@example.com")
    appointment = book(client, db_session, headers, fee=1000)

    assert appointment["fee"] == 1000
    assert appointment["gstPercentage"] == 12.0
    assert appointment["gstAmount"] == 120.0
    assert appointment["totalAmount"] == 1120.0


def test_rate_change_does_not_restate_an_existing_booking(client, db_session):
    admin = admin_headers(client, db_session)
    client.put("/api/v1/tax/config", json={"gstPercentage": 18}, headers=admin)

    headers = register_and_login(client, "quoted@example.com")
    appointment = book(client, db_session, headers, fee=1000)
    assert appointment["totalAmount"] == 1180.0

    client.put("/api/v1/tax/config", json={"gstPercentage": 28}, headers=admin)

    listed = client.get("/api/v1/appointments", headers=headers).json()["data"][
        "appointments"
    ][0]
    assert listed["gstPercentage"] == 18.0
    assert listed["totalAmount"] == 1180.0


def test_gst_rounds_to_two_decimals(client, db_session):
    admin = admin_headers(client, db_session)
    client.put("/api/v1/tax/config", json={"gstPercentage": 18}, headers=admin)

    headers = register_and_login(client, "rounder@example.com")
    appointment = book(client, db_session, headers, fee=333)

    assert appointment["gstAmount"] == 59.94
    assert appointment["totalAmount"] == 392.94


def test_zero_rate_books_tax_free(client, db_session):
    admin = admin_headers(client, db_session)
    client.put("/api/v1/tax/config", json={"gstPercentage": 0}, headers=admin)

    headers = register_and_login(client, "notaxed@example.com")
    appointment = book(client, db_session, headers, fee=800)

    assert appointment["gstAmount"] == 0.0
    assert appointment["totalAmount"] == 800.0


# ── Checkout consistency ─────────────────────────────────────────────────────


def test_payment_charges_the_appointment_total(client, db_session):
    admin = admin_headers(client, db_session)
    client.put("/api/v1/tax/config", json={"gstPercentage": 18}, headers=admin)

    headers = register_and_login(client, "checkout@example.com")
    appointment = book(client, db_session, headers, fee=1000)

    response = client.post(
        "/api/v1/payments/process",
        json={"appointmentId": appointment["id"], "amount": 1180, "method": "card"},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["data"]["amount"] == 1180.0


def test_payment_ignores_a_client_supplied_amount(client, db_session):
    """The order is built from the stored total, so a caller cannot pay the
    pre-tax fee (or anything else) by sending its own figure."""
    admin = admin_headers(client, db_session)
    client.put("/api/v1/tax/config", json={"gstPercentage": 18}, headers=admin)

    headers = register_and_login(client, "lowball@example.com")
    appointment = book(client, db_session, headers, fee=1000)

    response = client.post(
        "/api/v1/payments/process",
        json={"appointmentId": appointment["id"], "amount": 1, "method": "card"},
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["amount"] == 1180.0
    assert data["payment"]["amount"] == 1180.0


def test_legacy_appointment_without_snapshot_is_tax_free(client, db_session):
    """Rows booked before GST existed carry no snapshot; they must keep
    totalling their bare fee rather than picking up today's rate."""
    from app.models.appointment import Appointment

    headers = register_and_login(client, "legacy@example.com")
    appointment = book(client, db_session, headers, fee=900)

    row = db_session.get(Appointment, appointment["id"])
    row.gst_percentage = None
    row.gst_amount = None
    db_session.commit()

    listed = client.get("/api/v1/appointments", headers=headers).json()["data"][
        "appointments"
    ][0]
    assert listed["gstPercentage"] is None
    assert listed["gstAmount"] == 0.0
    assert listed["totalAmount"] == 900.0
