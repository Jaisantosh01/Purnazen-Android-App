"""Staff refresh tokens expire in STAFF_REFRESH_TOKEN_EXPIRE_DAYS; patients keep
the long default."""
from app.core.config import settings
from app.core.security import decode_token
from tests.test_dashboard import setup_admin


def _refresh_lifetime_days(client, email, password):
    data = client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["data"]
    claims = decode_token(data["refresh_token"])
    return round((claims["exp"] - claims["iat"]) / 86400)


def test_staff_refresh_token_is_short(client, db_session):
    setup_admin(db_session, client)
    assert _refresh_lifetime_days(client, "admin_dashboard@example.com", "admin123") == settings.STAFF_REFRESH_TOKEN_EXPIRE_DAYS


def test_patient_refresh_token_keeps_default(client):
    client.post("/api/v1/auth/register", json={
        "full_name": "P", "email": "p-token@example.com", "password": "secret123",
    })
    assert _refresh_lifetime_days(client, "p-token@example.com", "secret123") == settings.REFRESH_TOKEN_EXPIRE_DAYS
