"""Sprint 4: tongue pipeline + dashboard / trends / compare endpoints."""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.face_scan import FaceScan
from app.models.scan_result import ScanResult
from app.models.user import User


def _login(client):
    client.post("/api/v1/auth/register", json={"full_name": "Dash", "email": "dash@t.com", "password": "pass1234"})
    r = client.post("/api/v1/auth/login", json={"email": "dash@t.com", "password": "pass1234"})
    return r.json()["data"]["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _seed(db, user_id, glows, base_days_ago=3):
    """Create completed face scans + results with staggered dates; oldest first."""
    ids = []
    for i, glow in enumerate(glows):
        when = datetime.now(timezone.utc) - timedelta(days=base_days_ago - i)
        scan = FaceScan(user_id=user_id, scan_type="face", status="completed",
                        image_url="x", image_public_id="x", created_at=when,
                        processing_completed_at=when)
        db.add(scan); db.commit(); db.refresh(scan)
        db.add(ScanResult(
            scan_id=scan.id, glow_score=glow, overall_wellness_score=glow - 2,
            hydration_score=60, oiliness_score=40, wrinkle_score=30, pigmentation_score=25,
            dark_circle_score=35, pore_score=30, elasticity_score=65, muscle_tone_score=70,
            inflammation_score=20, toxin_indicator=30, skin_age_estimate=28,
            raw_metrics={"scoring_method": "cv"},
        ))
        db.commit()
        ids.append(scan.id)
    return ids


def _user_id(db):
    return db.query(User).filter(User.email == "dash@t.com").first().id


# ── dashboard ────────────────────────────────────────────────────────────────

def test_dashboard_empty(client):
    token = _login(client)
    r = client.get("/api/v1/face-glow/dashboard", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["hasData"] is False
    assert data["scanCount"] == 0


def test_dashboard_with_scans(client, db_session):
    token = _login(client)
    _seed(db_session, _user_id(db_session), [40, 55, 70])
    r = client.get("/api/v1/face-glow/dashboard", headers=_auth(token))
    data = r.json()["data"]
    assert data["hasData"] is True
    assert data["scanCount"] == 3
    assert data["latest"]["results"]["glowScore"] == 70.0  # newest
    assert len(data["glowTrend"]) == 3
    assert data["rollingGlow7d"] is not None


# ── trends ───────────────────────────────────────────────────────────────────

def test_trends_glow(client, db_session):
    token = _login(client)
    _seed(db_session, _user_id(db_session), [40, 55, 70])
    r = client.get("/api/v1/face-glow/trends?metric=glow_score", headers=_auth(token))
    data = r.json()["data"]
    assert data["metric"] == "glow_score"
    assert [p["value"] for p in data["points"]] == [40.0, 55.0, 70.0]


def test_trends_invalid_metric(client):
    token = _login(client)
    r = client.get("/api/v1/face-glow/trends?metric=not_a_metric", headers=_auth(token))
    assert r.status_code == 400


# ── compare ──────────────────────────────────────────────────────────────────

def test_compare_to_previous(client, db_session):
    token = _login(client)
    ids = _seed(db_session, _user_id(db_session), [50, 65])
    r = client.post(f"/api/v1/face-glow/scan/{ids[1]}/compare", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["hasBaseline"] is True
    assert data["deltas"]["glowScore"] == 15.0  # 65 - 50
    assert data["baseline"]["scanId"] == ids[0]


def test_compare_first_scan_has_no_baseline(client, db_session):
    token = _login(client)
    ids = _seed(db_session, _user_id(db_session), [50])
    r = client.post(f"/api/v1/face-glow/scan/{ids[0]}/compare", headers=_auth(token))
    data = r.json()["data"]
    assert data["hasBaseline"] is False


def test_compare_unknown_scan_404(client):
    token = _login(client)
    r = client.post("/api/v1/face-glow/scan/99999/compare", headers=_auth(token))
    assert r.status_code == 404


# ── tongue pipeline ──────────────────────────────────────────────────────────

def test_tongue_pipeline_markers():
    pytest.importorskip("cv2")
    import cv2
    import numpy as np
    from app.ai.tongue import analyze

    img = np.full((480, 480, 3), (40, 40, 40), np.uint8)
    cv2.ellipse(img, (240, 240), (150, 180), 0, 0, 360, (90, 90, 200), -1)  # reddish (BGR)
    out = analyze(img)
    assert out["tongue_body_color"] in {"pale", "normal", "red", "dark_red", "purple"}
    assert out["tongue_coat_color"] in {"white", "yellow"}
    assert out["tongue_moisture"] in {"moist", "dry"}
    assert 20.0 <= out["overall_wellness_score"] <= 95.0
