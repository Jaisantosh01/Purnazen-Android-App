"""Tests for Sprint 2 face scan pipeline.

Strategy:
- Upload endpoint: real HTTP test; background task is patched to avoid
  the DB-session conflict (the task opens its own SessionLocal which
  doesn't see the in-memory test DB).
- Pipeline unit test: calls run_scan_pipeline directly, passing a real
  in-memory session so all assertions can query the same connection.
- Status / history / delete: seed DB directly, then hit HTTP endpoints.
"""
import io
import os
from unittest.mock import patch

import pytest

# ── minimal valid JPEG bytes (SOI + APP0 + EOI) ──────────────────────────────
JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)

REGISTER_PAYLOAD = {"full_name": "Scan Tester", "email": "scan@test.com", "password": "pass1234"}


# ── helpers ──────────────────────────────────────────────────────────────────

def _register_and_login(client):
    client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    r = client.post("/api/v1/auth/login", json={"email": "scan@test.com", "password": "pass1234"})
    return r.json()["data"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _grant_consent(client, token):
    client.post(
        "/api/v1/consent/",
        json={"consent_type": "scan_storage", "granted": True},
        headers=_auth(token),
    )


def _upload_scan(client, token, scan_type="face"):
    return client.post(
        f"/api/v1/face-glow/scan/upload?scan_type={scan_type}",
        files={"file": ("face.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")},
        headers=_auth(token),
    )


# ── upload endpoint ───────────────────────────────────────────────────────────

def test_upload_requires_consent(client):
    token = _register_and_login(client)
    r = _upload_scan(client, token)
    assert r.status_code == 403
    assert "consent" in r.json()["message"].lower()


def test_upload_no_file(client):
    token = _register_and_login(client)
    _grant_consent(client, token)
    r = client.post(
        "/api/v1/face-glow/scan/upload",
        headers=_auth(token),
    )
    assert r.status_code in (400, 422)


def test_upload_non_image_rejected(client):
    token = _register_and_login(client)
    _grant_consent(client, token)
    with patch("app.services.scan_pipeline_service.run_scan_pipeline"):
        r = client.post(
            "/api/v1/face-glow/scan/upload",
            files={"file": ("doc.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
            headers=_auth(token),
        )
    assert r.status_code == 415


def test_upload_valid_jpeg_queued(client, tmp_path):
    token = _register_and_login(client)
    _grant_consent(client, token)

    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch.dict(os.environ, {}),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        r = _upload_scan(client, token)

    assert r.status_code == 202, r.text
    data = r.json()["data"]
    assert data["status"] == "queued"
    assert isinstance(data["scan_id"], int)
    assert data["estimated_seconds"] == 10


def test_upload_invalid_scan_type(client):
    token = _register_and_login(client)
    _grant_consent(client, token)
    with patch("app.services.scan_pipeline_service.run_scan_pipeline"):
        r = client.post(
            "/api/v1/face-glow/scan/upload?scan_type=brain",
            files={"file": ("face.jpg", io.BytesIO(JPEG_BYTES), "image/jpeg")},
            headers=_auth(token),
        )
    # Validation errors are normalised to 400 by the custom exception handler
    assert r.status_code == 400
    assert r.json()["success"] is False


# ── pipeline unit test ────────────────────────────────────────────────────────

def test_pipeline_mock_scores(db_session, tmp_path):
    """run_scan_pipeline populates ScanResult + ScanRecommendation rows."""
    from app.models.face_scan import FaceScan
    from app.models.user import User
    from app.services.scan_pipeline_service import run_scan_pipeline

    user = User(
        full_name="Pipeline Test",
        email="pipe@test.com",
        password="x",
        role="patient",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    scan = FaceScan(
        user_id=user.id,
        scan_type="face",
        status="queued",
        image_url=f"file://{tmp_path}/fake.jpg",
        image_public_id="fake/public/id",
    )
    db_session.add(scan)
    db_session.commit()
    db_session.refresh(scan)
    scan_id = scan.id

    # Patch SessionLocal so the background task uses the TEST session.
    from unittest.mock import MagicMock
    mock_session = MagicMock()
    mock_session.__enter__ = lambda s: db_session
    mock_session.__exit__ = MagicMock(return_value=False)

    with patch("app.services.scan_pipeline_service.SessionLocal", return_value=db_session):
        # Also patch close() so the test session isn't closed mid-test
        with patch.object(db_session, "close", lambda: None):
            run_scan_pipeline(scan_id, "face")

    db_session.expire_all()
    scan_after = db_session.get(FaceScan, scan_id)
    assert scan_after.status == "completed", scan_after.error_message

    from app.models.scan_result import ScanResult
    result = db_session.query(ScanResult).filter(ScanResult.scan_id == scan_id).first()
    assert result is not None
    assert float(result.glow_score) == 75.0
    assert float(result.hydration_score) == 75.0

    from app.models.scan_recommendation import ScanRecommendation
    recs = db_session.query(ScanRecommendation).filter(ScanRecommendation.scan_id == scan_id).all()
    assert len(recs) == 3
    assert recs[0].routine_key == "MorningGlow"


# ── status endpoint ───────────────────────────────────────────────────────────

def test_status_not_found(client):
    token = _register_and_login(client)
    r = client.get("/api/v1/face-glow/scan/99999/status", headers=_auth(token))
    assert r.status_code == 404


def test_status_queued(client, tmp_path):
    token = _register_and_login(client)
    _grant_consent(client, token)

    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        upload_r = _upload_scan(client, token)

    scan_id = upload_r.json()["data"]["scan_id"]
    r = client.get(f"/api/v1/face-glow/scan/{scan_id}/status", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "queued"
    assert data["results"] is None


def test_status_cannot_see_other_users_scan(client, db_session, tmp_path):
    # Register two users
    client.post("/api/v1/auth/register", json={"full_name": "A", "email": "a@t.com", "password": "pass1234"})
    client.post("/api/v1/auth/register", json={"full_name": "B", "email": "b@t.com", "password": "pass1234"})
    r_a = client.post("/api/v1/auth/login", json={"email": "a@t.com", "password": "pass1234"})
    r_b = client.post("/api/v1/auth/login", json={"email": "b@t.com", "password": "pass1234"})
    tok_a = r_a.json()["data"]["access_token"]
    tok_b = r_b.json()["data"]["access_token"]

    client.post("/api/v1/consent/", json={"consent_type": "scan_storage", "granted": True}, headers=_auth(tok_a))

    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        upload_r = _upload_scan(client, tok_a)

    scan_id = upload_r.json()["data"]["scan_id"]
    r = client.get(f"/api/v1/face-glow/scan/{scan_id}/status", headers=_auth(tok_b))
    assert r.status_code == 404


# ── history endpoint ──────────────────────────────────────────────────────────

def test_history_empty(client):
    token = _register_and_login(client)
    r = client.get("/api/v1/face-glow/history", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["scans"] == []
    assert data["total"] == 0


def test_history_shows_uploaded_scan(client, tmp_path):
    token = _register_and_login(client)
    _grant_consent(client, token)

    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        _upload_scan(client, token, "face")
        _upload_scan(client, token, "face")

    r = client.get("/api/v1/face-glow/history", headers=_auth(token))
    data = r.json()["data"]
    assert data["total"] == 2
    assert data["scans"][0]["scanType"] == "face"


def test_history_filter_by_scan_type(client, tmp_path):
    token = _register_and_login(client)
    _grant_consent(client, token)

    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        _upload_scan(client, token, "face")
        _upload_scan(client, token, "tongue")

    r = client.get("/api/v1/face-glow/history?scan_type=tongue", headers=_auth(token))
    data = r.json()["data"]
    assert data["total"] == 1
    assert data["scans"][0]["scanType"] == "tongue"


# ── delete endpoint ───────────────────────────────────────────────────────────

def test_delete_scan(client, tmp_path):
    token = _register_and_login(client)
    _grant_consent(client, token)

    with patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)):
        with patch("app.services.scan_pipeline_service.run_scan_pipeline"):
            upload_r = _upload_scan(client, token)
        scan_id = upload_r.json()["data"]["scan_id"]

        r = client.delete(f"/api/v1/face-glow/scan/{scan_id}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["success"] is True

    # Confirm it's gone from history
    hist = client.get("/api/v1/face-glow/history", headers=_auth(token))
    assert hist.json()["data"]["total"] == 0


def test_delete_other_users_scan_returns_404(client, tmp_path):
    client.post("/api/v1/auth/register", json={"full_name": "A", "email": "a2@t.com", "password": "pass1234"})
    client.post("/api/v1/auth/register", json={"full_name": "B", "email": "b2@t.com", "password": "pass1234"})
    r_a = client.post("/api/v1/auth/login", json={"email": "a2@t.com", "password": "pass1234"})
    r_b = client.post("/api/v1/auth/login", json={"email": "b2@t.com", "password": "pass1234"})
    tok_a = r_a.json()["data"]["access_token"]
    tok_b = r_b.json()["data"]["access_token"]

    client.post("/api/v1/consent/", json={"consent_type": "scan_storage", "granted": True}, headers=_auth(tok_a))

    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        upload_r = _upload_scan(client, tok_a)

    scan_id = upload_r.json()["data"]["scan_id"]
    r = client.delete(f"/api/v1/face-glow/scan/{scan_id}", headers=_auth(tok_b))
    assert r.status_code == 404


# ── local storage integration test ───────────────────────────────────────────

def test_local_storage_creates_file(client, tmp_path):
    """When Cloudinary is not configured the image is saved to LOCAL_UPLOADS_DIR."""
    token = _register_and_login(client)
    _grant_consent(client, token)

    with (
        patch("app.services.upload_service._configure_cloudinary", return_value=False),
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch("app.services.upload_service.settings") as mock_settings,
    ):
        mock_settings.SCAN_MAX_FILE_SIZE_MB = 15
        mock_settings.LOCAL_UPLOADS_DIR = str(tmp_path)
        mock_settings.LOCAL_UPLOADS_BASE_URL = "http://localhost:5000"

        r = _upload_scan(client, token)

    assert r.status_code == 202
    # At least one file should exist in the tmp dir
    all_files = list(tmp_path.rglob("*"))
    image_files = [f for f in all_files if f.is_file()]
    assert len(image_files) >= 1
