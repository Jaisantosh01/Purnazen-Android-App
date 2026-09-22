from datetime import time

from tests.test_doctors import add_availability, next_weekday, seed_doctor

REGISTER_PAYLOAD = {
    "full_name": "Paying Patient",
    "email": "payer@example.com",
    "password": "secret123",
}


def auth_headers(client, email="payer@example.com"):
    client.post("/api/v1/auth/register", json={**REGISTER_PAYLOAD, "email": email})
    tokens = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "secret123"}
    ).json()["data"]
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def book_appointment(client, db_session, headers):
    doctor = seed_doctor(db_session)
    slots = add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    response = client.post(
        "/api/v1/appointments/book",
        json={
            "doctorId": str(doctor.id),
            "visitType": "video",
            "date": next_weekday("Monday").isoformat(),
            "slotTimingId": str(slots[0].id),
            "fee": 1200,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()["data"]


def process_payment(client, headers, appointment_id, amount=1416):
    return client.post(
        "/api/v1/payments/process",
        json={"appointmentId": appointment_id, "amount": amount, "method": "card"},
        headers=headers,
    )


def get_appointment(client, headers):
    appointments = client.get("/api/v1/appointments", headers=headers).json()["data"]
    return appointments["appointments"][0]


def test_process_creates_sandbox_order(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)

    response = process_payment(client, headers, appointment["id"])
    assert response.status_code == 201
    data = response.json()["data"]

    assert data["orderId"].startswith("order_sbx_")
    assert data["mode"] == "local-sandbox"
    assert data["amount"] == 1416
    assert data["payment"]["status"] == "created"
    assert data["payment"]["appointmentId"] == appointment["id"]
    # local sandbox hands the client a signature pair (no checkout SDK)
    assert data["sandboxPaymentId"]
    assert data["sandboxSignature"]


def test_verify_marks_appointment_paid(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)
    order = process_payment(client, headers, appointment["id"]).json()["data"]

    response = client.post(
        "/api/v1/payments/verify",
        json={
            "orderId": order["orderId"],
            "paymentId": order["sandboxPaymentId"],
            "signature": order["sandboxSignature"],
        },
        headers=headers,
    )
    assert response.status_code == 200
    payment = response.json()["data"]["payment"]
    assert payment["status"] == "paid"
    assert payment["paymentId"] == order["sandboxPaymentId"]

    assert get_appointment(client, headers)["paymentStatus"] == "paid"


def test_verify_bad_signature_leaves_appointment_unpaid(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)
    order = process_payment(client, headers, appointment["id"]).json()["data"]

    response = client.post(
        "/api/v1/payments/verify",
        json={
            "orderId": order["orderId"],
            "paymentId": order["sandboxPaymentId"],
            "signature": "tampered-signature",
        },
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["message"] == "Payment verification failed"

    assert get_appointment(client, headers)["paymentStatus"] == "unpaid"


def test_process_rejects_foreign_appointment(client, db_session):
    owner_headers = auth_headers(client)
    appointment = book_appointment(client, db_session, owner_headers)

    other_headers = auth_headers(client, email="intruder@example.com")
    response = process_payment(client, other_headers, appointment["id"])
    assert response.status_code == 404


def test_process_rejects_double_payment(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)
    order = process_payment(client, headers, appointment["id"]).json()["data"]
    client.post(
        "/api/v1/payments/verify",
        json={
            "orderId": order["orderId"],
            "paymentId": order["sandboxPaymentId"],
            "signature": order["sandboxSignature"],
        },
        headers=headers,
    )

    response = process_payment(client, headers, appointment["id"])
    assert response.status_code == 400
    assert response.json()["message"] == "This appointment is already paid"


def test_process_rejects_invalid_amount(client, db_session):
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/payments/process",
        json={"amount": 0},
        headers=headers,
    )
    assert response.status_code == 400


def test_payments_require_auth(client):
    assert client.post("/api/v1/payments/process", json={"amount": 1}).status_code == 401
    assert (
        client.post(
            "/api/v1/payments/verify",
            json={"orderId": "x", "paymentId": "y", "signature": "z"},
        ).status_code
        == 401
    )


def test_verify_unknown_order(client):
    headers = auth_headers(client)
    response = client.post(
        "/api/v1/payments/verify",
        json={"orderId": "order_nope", "paymentId": "y", "signature": "z"},
        headers=headers,
    )
    assert response.status_code == 404


def pay_appointment(client, headers, appointment_id):
    order = process_payment(client, headers, appointment_id).json()["data"]
    response = client.post(
        "/api/v1/payments/verify",
        json={
            "orderId": order["orderId"],
            "paymentId": order["sandboxPaymentId"],
            "signature": order["sandboxSignature"],
        },
        headers=headers,
    )
    assert response.status_code == 200
    return response.json()["data"]["payment"]


def refund(client, headers, appointment_id, amount=None):
    body = {"appointmentId": appointment_id}
    if amount is not None:
        body["amount"] = amount
    return client.post("/api/v1/payments/refund", json=body, headers=headers)


def test_full_refund_cancels_appointment(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)
    paid = pay_appointment(client, headers, appointment["id"])

    response = refund(client, headers, appointment["id"])
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["refund"]["id"].startswith("rfnd_sbx_")
    assert data["payment"]["status"] == "refunded"
    assert data["payment"]["refundedAmount"] == paid["amount"]

    after = get_appointment(client, headers)
    assert after["paymentStatus"] == "refunded"
    assert after["status"] == "cancelled"

    # Nothing left to refund
    assert refund(client, headers, appointment["id"]).status_code == 400


def test_partial_refund_keeps_booking(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)
    paid = pay_appointment(client, headers, appointment["id"])

    response = refund(client, headers, appointment["id"], amount=100)
    assert response.status_code == 200
    payment = response.json()["data"]["payment"]
    assert payment["status"] == "partially_refunded"
    assert payment["refundedAmount"] == 100

    after = get_appointment(client, headers)
    assert after["paymentStatus"] == "paid"
    assert after["status"] != "cancelled"

    # Cannot refund more than is left
    too_much = refund(client, headers, appointment["id"], amount=paid["amount"])
    assert too_much.status_code == 400

    # The remainder closes it out
    rest = refund(client, headers, appointment["id"])
    assert rest.status_code == 200
    assert rest.json()["data"]["payment"]["status"] == "refunded"


def test_refund_requires_paid_appointment(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)

    response = refund(client, headers, appointment["id"])
    assert response.status_code == 400


def test_refund_rejects_foreign_appointment(client, db_session):
    headers = auth_headers(client)
    appointment = book_appointment(client, db_session, headers)
    pay_appointment(client, headers, appointment["id"])

    other = auth_headers(client, email="other-refund@example.com")
    assert refund(client, other, appointment["id"]).status_code == 404
