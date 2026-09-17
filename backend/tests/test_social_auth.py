"""Social sign-in through Firebase Auth: Google, and Sign in with Apple.

The Firebase token check itself (signature, audience, expiry) belongs to
google-auth; here it is replaced by a stub returning the claims Firebase would
issue, so these tests cover what this app does with them.
"""
import pytest

from app.core.config import settings
from app.services import social_auth

URL = "/api/v1/auth/social"


@pytest.fixture()
def firebase_claims(monkeypatch):
    """Set the claims the next verified token will carry."""
    box = {}
    monkeypatch.setattr(settings, "FIREBASE_PROJECT_ID", "purnazen-test", raising=False)

    def fake_verify(token, request, audience=None):
        assert audience == "purnazen-test"
        if token == "bad":
            raise ValueError("bad token")
        return dict(box)

    monkeypatch.setattr(social_auth.google_id_token, "verify_firebase_token", fake_verify)
    return box


def _apple(uid="apple-uid-1", email="x1y2@privaterelay.appleid.com", verified=True):
    return {
        "sub": uid,
        "email": email,
        "email_verified": verified,
        "firebase": {"sign_in_provider": "apple.com"},
    }


def test_apple_first_sign_in_creates_patient_with_forwarded_name(client, firebase_claims):
    firebase_claims.update(_apple())
    r = client.post(URL, json={"id_token": "t", "expected_role": "patient", "full_name": "Asha Rao"})
    assert r.status_code in (200, 201), r.text
    user = r.json()["data"]["user"]
    assert user["full_name"] == "Asha Rao"
    assert user["email"] == "x1y2@privaterelay.appleid.com"
    assert user["auth_provider"] == "apple"
    assert user["social_linked"] is True
    assert user["role"] == "patient"


def test_apple_repeat_sign_in_reuses_account_without_name(client, firebase_claims):
    firebase_claims.update(_apple())
    client.post(URL, json={"id_token": "t", "full_name": "Asha Rao"})
    # Apple sends no name after the first authorisation.
    r = client.post(URL, json={"id_token": "t"})
    assert r.status_code in (200, 201), r.text
    assert r.json()["data"]["user"]["full_name"] == "Asha Rao"


def test_apple_name_falls_back_to_email_prefix(client, firebase_claims):
    firebase_claims.update(_apple(uid="u2", email="meera@example.com"))
    r = client.post(URL, json={"id_token": "t"})
    assert r.json()["data"]["user"]["full_name"] == "meera"


def test_apple_email_is_trusted_even_if_flag_missing(client, firebase_claims):
    firebase_claims.update(_apple(uid="u3", email="k@example.com", verified=False))
    r = client.post(URL, json={"id_token": "t"})
    assert r.status_code in (200, 201), r.text


def test_provider_name_wins_over_client_name(client, firebase_claims):
    firebase_claims.update({
        "sub": "g1",
        "email": "priya@example.com",
        "email_verified": True,
        "name": "Priya from Google",
        "firebase": {"sign_in_provider": "google.com"},
    })
    r = client.post(URL, json={"id_token": "t", "full_name": "Something Else"})
    assert r.json()["data"]["user"]["full_name"] == "Priya from Google"


def test_unverified_google_email_is_refused(client, firebase_claims):
    firebase_claims.update({
        "sub": "g2",
        "email": "nov@example.com",
        "email_verified": False,
        "firebase": {"sign_in_provider": "google.com"},
    })
    r = client.post(URL, json={"id_token": "t"})
    assert r.status_code == 403


def test_staff_app_cannot_create_accounts(client, firebase_claims):
    firebase_claims.update(_apple(uid="u4", email="newdoc@example.com"))
    r = client.post(URL, json={"id_token": "t", "expected_role": "doctor"})
    assert r.status_code == 403


def test_invalid_token_is_401(client, firebase_claims):
    r = client.post(URL, json={"id_token": "bad"})
    assert r.status_code == 401


def test_overlong_name_is_rejected(client, firebase_claims):
    firebase_claims.update(_apple(uid="u5"))
    r = client.post(URL, json={"id_token": "t", "full_name": "x" * 121})
    assert r.status_code in (400, 422)  # the app reports validation errors as 400
