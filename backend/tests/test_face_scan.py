"""Tests for the face scan pipeline (Sprints 2–3 + Cycle-1 foundation work).

Strategy:
- Upload/plumbing endpoints: real HTTP test; the AI pipeline background task is
  patched out, and the capture-quality gate is patched to a no-op for plumbing
  tests (it's exercised separately below) so a synthetic image isn't rejected.
- Quality gate: unit-tested directly against crafted images, plus one endpoint
  test proving the 422 + reason wiring.
- Real pipeline: runs run_scan_pipeline on a real on-disk image and asserts the
  recalibrated CV scorer produces in-range scores + recommendations.

Images: the old 20-byte fake JPEG is not decodable (PIL/cv2 reject it), so we
generate real JPEGs with Pillow.
"""
import io
import os
import uuid
from unittest.mock import patch

import pytest

REGISTER_PAYLOAD = {"full_name": "Scan Tester", "email": "scan@test.com", "password": "pass1234"}

# Patch target for the synchronous capture-quality gate.
_GATE = "app.api.v1.endpoints.face_scan._quality_gate"


# ── image helpers ────────────────────────────────────────────────────────────

def _real_jpeg(w=600, h=600, rgb=(150, 150, 150)) -> bytes:
    """A real, decodable JPEG (passes MIME + the 400×400 dimension check)."""
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (w, h), rgb).save(buf, format="JPEG")
    return buf.getvalue()


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


def _upload_scan(client, token, scan_type="face", content=None):
    return client.post(
        f"/api/v1/face-glow/scan/upload?scan_type={scan_type}",
        files={"file": ("face.jpg", io.BytesIO(content or _real_jpeg()), "image/jpeg")},
        headers=_auth(token),
    )


# ── upload endpoint (gate patched to a no-op) ────────────────────────────────

def test_upload_requires_consent(client):
    token = _register_and_login(client)
    r = _upload_scan(client, token)
    assert r.status_code == 403
    assert "consent" in r.json()["message"].lower()


def test_upload_no_file(client):
    token = _register_and_login(client)
    _grant_consent(client, token)
    r = client.post("/api/v1/face-glow/scan/upload", headers=_auth(token))
    assert r.status_code in (400, 422)


def test_upload_non_image_rejected(client):
    token = _register_and_login(client)
    _grant_consent(client, token)
    with patch("app.services.scan_pipeline_service.run_scan_pipeline"), patch(_GATE, return_value=None):
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
        patch(_GATE, return_value=None),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        r = _upload_scan(client, token)
    assert r.status_code == 202, r.text
    data = r.json()["data"]
    assert data["status"] == "queued"
    # scan_id is a UUID string now (was an int PK before the UUID migration)
    assert uuid.UUID(str(data["scan_id"]))


def test_upload_invalid_scan_type(client):
    token = _register_and_login(client)
    _grant_consent(client, token)
    with patch("app.services.scan_pipeline_service.run_scan_pipeline"):
        r = client.post(
            "/api/v1/face-glow/scan/upload?scan_type=brain",
            files={"file": ("face.jpg", io.BytesIO(_real_jpeg()), "image/jpeg")},
            headers=_auth(token),
        )
    assert r.status_code == 400
    assert r.json()["success"] is False


# ── capture-quality gate ─────────────────────────────────────────────────────

def test_quality_gate_unit_flags_issues():
    """assess_quality flags dark / blurry / no-face images and ranks by priority."""
    pytest.importorskip("cv2")
    import numpy as np
    from app.ai.quality import assess_quality, first_blocking_issue

    # Flat dark image: no detectable face + too dark → not ok.
    dark = np.full((480, 480, 3), 10, np.uint8)
    res = assess_quality(dark)
    assert res["ok"] is False
    codes = {i["code"] for i in res["issues"]}
    assert "no_face" in codes or "too_dark" in codes
    assert first_blocking_issue(res) is not None

    # Bright textured (noisy) image: sharp + bright, but still no real face.
    rng = np.random.default_rng(0)
    noisy = rng.integers(120, 200, (480, 480, 3), dtype=np.uint8)
    res2 = assess_quality(noisy)
    assert "too_blurry" not in {i["code"] for i in res2["issues"]}


def test_quality_gate_endpoint_returns_422_with_reason(client):
    """A too-dark/faceless image is rejected at upload with a reason + guidance."""
    pytest.importorskip("cv2")
    token = _register_and_login(client)
    _grant_consent(client, token)
    dark = _real_jpeg(rgb=(6, 6, 6))
    with patch("app.services.scan_pipeline_service.run_scan_pipeline"):
        r = _upload_scan(client, token, content=dark)
    assert r.status_code == 422, r.text
    body = r.json()
    assert body["success"] is False
    assert body.get("reason")       # machine code present
    assert body.get("guidance")     # user-facing fix present


# ── real pipeline ────────────────────────────────────────────────────────────

def test_pipeline_real_scores(db_session, tmp_path):
    """run_scan_pipeline computes real, in-range CV scores + recommendations."""
    pytest.importorskip("cv2")
    import cv2
    import numpy as np
    from app.models.face_scan import FaceScan
    from app.models.user import User
    from app.services.scan_pipeline_service import run_scan_pipeline

    # Write a real, textured image where the pipeline reads it (local storage).
    public_id = "face_scans/test/raw/img.jpg"
    abs_path = os.path.join(str(tmp_path), public_id.replace("/", os.sep))
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    rng = np.random.default_rng(1)
    cv2.imwrite(abs_path, rng.integers(90, 180, (600, 600, 3), dtype=np.uint8))

    from app.models.role import Role
    patient_role = db_session.query(Role).filter_by(name="patient").first()
    user = User(full_name="Pipeline", email="pipe@test.com", password="x", role_id=patient_role.id)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    scan = FaceScan(
        user_id=user.id, scan_type="face", status="queued",
        image_url=f"file://{abs_path}", image_public_id=public_id,
    )
    db_session.add(scan)
    db_session.commit()
    db_session.refresh(scan)
    scan_id = scan.id

    with (
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
        # Force local storage (no network) for the processed-image upload.
        patch("app.core.config.settings.AZURE_STORAGE_ACCOUNT_NAME", ""),
        patch("app.services.scan_pipeline_service.SessionLocal", return_value=db_session),
        patch.object(db_session, "close", lambda: None),
    ):
        run_scan_pipeline(scan_id, "face")

    db_session.expire_all()
    scan_after = db_session.get(FaceScan, scan_id)
    assert scan_after.status == "completed", scan_after.error_message

    from app.models.scan_result import ScanResult
    result = db_session.query(ScanResult).filter(ScanResult.scan_id == scan_id).first()
    assert result is not None
    for field in ("glow_score", "oiliness_score", "overall_wellness_score"):
        val = float(getattr(result, field))
        assert 0.0 <= val <= 100.0, f"{field}={val} out of range"
    # Cycle-1: audit metadata recorded for the UI/report.
    assert result.raw_metrics.get("scoring_method") in ("cv", "model")
    assert "confidence" in result.raw_metrics
    assert "skin_tone" in result.raw_metrics

    from app.models.scan_recommendation import ScanRecommendation
    recs = db_session.query(ScanRecommendation).filter(ScanRecommendation.scan_id == scan_id).all()
    assert len(recs) >= 1


# ── status endpoint ──────────────────────────────────────────────────────────

def test_status_not_found(client):
    token = _register_and_login(client)
    r = client.get(f"/api/v1/face-glow/scan/{uuid.uuid4()}/status", headers=_auth(token))
    assert r.status_code == 404


def test_status_queued(client, tmp_path):
    token = _register_and_login(client)
    _grant_consent(client, token)
    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch(_GATE, return_value=None),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        upload_r = _upload_scan(client, token)
    scan_id = upload_r.json()["data"]["scan_id"]
    r = client.get(f"/api/v1/face-glow/scan/{scan_id}/status", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["status"] == "queued"
    assert data["results"] is None


def test_status_cannot_see_other_users_scan(client, tmp_path):
    client.post("/api/v1/auth/register", json={"full_name": "A", "email": "a@t.com", "password": "pass1234"})
    client.post("/api/v1/auth/register", json={"full_name": "B", "email": "b@t.com", "password": "pass1234"})
    tok_a = client.post("/api/v1/auth/login", json={"email": "a@t.com", "password": "pass1234"}).json()["data"]["access_token"]
    tok_b = client.post("/api/v1/auth/login", json={"email": "b@t.com", "password": "pass1234"}).json()["data"]["access_token"]
    client.post("/api/v1/consent/", json={"consent_type": "scan_storage", "granted": True}, headers=_auth(tok_a))
    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch(_GATE, return_value=None),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        upload_r = _upload_scan(client, tok_a)
    scan_id = upload_r.json()["data"]["scan_id"]
    r = client.get(f"/api/v1/face-glow/scan/{scan_id}/status", headers=_auth(tok_b))
    assert r.status_code == 404


# ── history endpoint ─────────────────────────────────────────────────────────

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
        patch(_GATE, return_value=None),
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
        patch(_GATE, return_value=None),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        _upload_scan(client, token, "face")
        _upload_scan(client, token, "tongue")
    r = client.get("/api/v1/face-glow/history?scan_type=tongue", headers=_auth(token))
    data = r.json()["data"]
    assert data["total"] == 1
    assert data["scans"][0]["scanType"] == "tongue"


# ── delete endpoint ──────────────────────────────────────────────────────────

def test_delete_scan(client, tmp_path):
    token = _register_and_login(client)
    _grant_consent(client, token)
    with (
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch(_GATE, return_value=None),
    ):
        upload_r = _upload_scan(client, token)
        scan_id = upload_r.json()["data"]["scan_id"]
        r = client.delete(f"/api/v1/face-glow/scan/{scan_id}", headers=_auth(token))
    assert r.status_code == 200
    assert r.json()["success"] is True
    hist = client.get("/api/v1/face-glow/history", headers=_auth(token))
    assert hist.json()["data"]["total"] == 0


def test_delete_other_users_scan_returns_404(client, tmp_path):
    client.post("/api/v1/auth/register", json={"full_name": "A", "email": "a2@t.com", "password": "pass1234"})
    client.post("/api/v1/auth/register", json={"full_name": "B", "email": "b2@t.com", "password": "pass1234"})
    tok_a = client.post("/api/v1/auth/login", json={"email": "a2@t.com", "password": "pass1234"}).json()["data"]["access_token"]
    tok_b = client.post("/api/v1/auth/login", json={"email": "b2@t.com", "password": "pass1234"}).json()["data"]["access_token"]
    client.post("/api/v1/consent/", json={"consent_type": "scan_storage", "granted": True}, headers=_auth(tok_a))
    with (
        patch("app.services.scan_pipeline_service.run_scan_pipeline"),
        patch(_GATE, return_value=None),
        patch("app.core.config.settings.LOCAL_UPLOADS_DIR", str(tmp_path)),
    ):
        upload_r = _upload_scan(client, tok_a)
    scan_id = upload_r.json()["data"]["scan_id"]
    r = client.delete(f"/api/v1/face-glow/scan/{scan_id}", headers=_auth(tok_b))
    assert r.status_code == 404
