"""Two-step verification: TOTP maths, enrolment, sign-in challenge, replay
protection, recovery codes, and enforcement for required roles."""
import hashlib

import pytest

from app.core import totp
from app.core.config import settings
from app.core.crypto import decrypt
from app.models.user import User
from tests.test_dashboard import setup_admin
from tests.test_therapy_history import auth_headers

RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # b"12345678901234567890"


@pytest.mark.parametrize("t,expected", [
    (59, "94287082"), (1111111109, "07081804"), (1111111111, "14050471"),
    (1234567890, "89005924"), (2000000000, "69279037"),
])
def test_rfc6238_sha1_vectors(t, expected):
    key = totp._key(RFC_SECRET)
    assert totp.hotp(key, int(t // 30), digits=8, digest=hashlib.sha1) == expected


def test_verify_window_and_replay():
    secret = totp.generate_secret()
    now = 1_800_000_000
    code = totp.hotp(totp._key(secret), totp.current_step(now))
    step = totp.verify(secret, code, now=now)
    assert step == totp.current_step(now)
    assert totp.verify(secret, code, last_used_step=step, now=now) is None  # replay
    assert totp.verify(secret, code, now=now + 30) is not None  # one step of drift
    assert totp.verify(secret, code, now=now + 120) is None
    assert totp.verify(secret, "12345", now=now) is None


def test_provisioning_uri():
    uri = totp.provisioning_uri("ABC", "a@b.co", "Purnazen")
    assert uri.startswith("otpauth://totp/Purnazen%3Aa%40b.co?")
    assert "secret=ABC" in uri and "issuer=Purnazen" in uri


_CLOCK = {"step": 0}


@pytest.fixture(autouse=True)
def _one_step_per_code(monkeypatch):
    """A real authenticator hands out one code per 30 s; these tests use several
    in a row. Pin the server's step and let _code() advance it, so codes stay
    in the ±1 window without tripping the replay guard."""
    _CLOCK["step"] = totp.current_step()
    monkeypatch.setattr(totp, "current_step",
                        lambda now=None: _CLOCK["step"] if now is None else int(now // totp.PERIOD))


def _code(db, email):
    user = db.query(User).filter_by(email=email).first()
    db.refresh(user)
    secret = decrypt(user.mfa_secret)
    _CLOCK["step"] += 1
    return totp.hotp(totp._key(secret), _CLOCK["step"])


def _enrol(client, db, headers, email):
    setup = client.post("/api/v1/auth/mfa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    assert setup.json()["data"]["otpauth_uri"].startswith("otpauth://totp/")
    r = client.post("/api/v1/auth/mfa/enable", json={"code": _code(db, email)}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]["recovery_codes"]


def _login(client, email, password="secret123"):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password}).json()["data"]


def test_enrolment_then_login_needs_a_code(client, db_session):
    email = "patient@example.com"
    headers = auth_headers(client, email)
    codes = _enrol(client, db_session, headers, email)
    assert len(codes) == 10

    user = db_session.query(User).filter_by(email=email).first()
    assert user.mfa_enabled is True
    assert "mfa_secret" not in user.to_dict()
    assert decrypt(user.mfa_secret) and user.mfa_secret != decrypt(user.mfa_secret)

    step1 = _login(client, email)
    assert step1["mfa_required"] is True
    assert "access_token" not in step1

    bad = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": step1["mfa_token"], "code": "000000"})
    assert bad.status_code == 401

    # The mfa token is not an access token.
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {step1['mfa_token']}"}).status_code == 401

    code = _code(db_session, email)
    ok = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": step1["mfa_token"], "code": code})
    assert ok.status_code == 200, ok.text
    assert ok.json()["data"]["access_token"]

    # Same code again: refused (replay).
    again = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": _login(client, email)["mfa_token"], "code": code})
    assert again.status_code == 401


def test_recovery_code_works_once(client, db_session):
    email = "patient@example.com"
    headers = auth_headers(client, email)
    codes = _enrol(client, db_session, headers, email)

    token = _login(client, email)["mfa_token"]
    r = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": token, "code": codes[0].upper()})
    assert r.status_code == 200
    assert r.json()["data"]["recovery_codes_left"] == 9

    token = _login(client, email)["mfa_token"]
    r = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": token, "code": codes[0]})
    assert r.status_code == 401


def test_disable_needs_a_code(client, db_session):
    email = "patient@example.com"
    headers = auth_headers(client, email)
    _enrol(client, db_session, headers, email)
    assert client.post("/api/v1/auth/mfa/disable", json={"code": "000000"}, headers=headers).status_code == 400
    r = client.post("/api/v1/auth/mfa/disable", json={"code": _code(db_session, email)}, headers=headers)
    assert r.status_code == 200
    assert r.json()["data"]["user"]["mfa_enabled"] is False
    assert "access_token" in _login(client, email)


def test_required_role_is_blocked_until_enrolled(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "MFA_REQUIRED_ROLES", "admin")
    headers = setup_admin(db_session, client)
    email = "admin_dashboard@example.com"

    me = client.get("/api/v1/auth/me", headers=headers).json()["data"]["user"]
    assert me["mfa_required"] is True and me["mfa_enabled"] is False

    blocked = client.get("/api/v1/admin/stats", headers=headers)
    assert blocked.status_code == 403
    assert "two_step_required" in blocked.text

    _enrol(client, db_session, headers, email)
    assert client.get("/api/v1/admin/stats", headers=headers).status_code == 200

    # Required roles cannot switch it off.
    r = client.post("/api/v1/auth/mfa/disable", json={"code": _code(db_session, email)}, headers=headers)
    assert r.status_code == 403


def test_setup_twice_is_refused_once_enabled(client, db_session):
    email = "patient@example.com"
    headers = auth_headers(client, email)
    _enrol(client, db_session, headers, email)
    assert client.post("/api/v1/auth/mfa/setup", headers=headers).status_code == 409


def test_expired_or_forged_mfa_token(client):
    r = client.post("/api/v1/auth/mfa/verify", json={"mfa_token": "not-a-token", "code": "123456"})
    assert r.status_code == 401
