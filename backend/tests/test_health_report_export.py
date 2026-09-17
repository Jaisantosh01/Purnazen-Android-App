"""Health report: recent runs + streak in the JSON, and the PDF export link."""
from app.models.therapy_session_group import TherapySessionGroup
from tests.test_therapy_history import auth_headers, seed_group_with_videos


def test_report_lists_recent_runs_and_streak(client, db_session):
    headers = auth_headers(client)
    me = client.get("/api/v1/auth/me", headers=headers).json()["data"]["user"]
    group, _ = seed_group_with_videos(db_session)
    db_session.add(TherapySessionGroup(user_id=me["id"], group_id=group.id, session_type="wellness", status="completed"))
    db_session.commit()

    r = client.get("/api/v1/users/me/health-report", headers=headers)
    assert r.status_code == 200, r.text
    therapy = r.json()["data"]["therapy"]
    assert therapy["streakDays"] == 1
    assert therapy["recent"][0]["title"] == "Wellness & Prevention"
    assert therapy["recent"][0]["status"] == "completed"


def test_pdf_export_link_round_trip(client):
    headers = auth_headers(client)
    r = client.post("/api/v1/users/me/health-report/export", headers=headers)
    assert r.status_code == 200, r.text
    url = r.json()["data"]["url"]
    assert "/users/me/health-report.pdf?t=" in url

    pdf = client.get(url)  # no bearer header — the link token carries auth
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")

    # An access token is not a link token, and a bad one is refused.
    assert client.get("/api/v1/users/me/health-report.pdf?t=nope").status_code == 401
    access = headers["Authorization"].split()[1]
    assert client.get(f"/api/v1/users/me/health-report.pdf?t={access}").status_code == 401
