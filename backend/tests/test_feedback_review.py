"""Staff review of patient session feedback: a doctor sees and answers only
their own patients; an admin sees everyone; `status` separates what is still
waiting for a reply."""
from datetime import date, time

from app.core.security import hash_password
from app.models.appointment import Appointment
from app.models.day_of_week import DayOfWeek
from app.models.doctor import Doctor
from app.models.role import Role
from app.models.slot_timings import SlotTimings
from app.models.specialty import Specialty
from app.models.user import User
from tests.feedback_helpers import login, make_feedback
from tests.test_therapy_history import auth_headers, seed_group_with_videos


def make_staff(db, email, role):
    user = User(
        full_name=f"{role.title()} {email.split('@')[0]}",
        email=email,
        password=hash_password("secret123"),
        role_id=db.query(Role).filter_by(name=role).first().id,
    )
    db.add(user)
    db.commit()
    return user


def make_doctor(db, email):
    user = make_staff(db, email, "doctor")
    specialty = db.query(Specialty).first() or Specialty(name="General")
    db.add(specialty)
    db.flush()
    doctor = Doctor(user_id=user.id, specialty_id=specialty.id, experience_years=5,
                    consultation_fee=500, is_active=True)
    db.add(doctor)
    db.commit()
    return user, doctor


def book(db, patient_id, doctor, status="booked"):
    day = db.query(DayOfWeek).first() or DayOfWeek(day_number=1, day="Monday")
    db.add(day)
    db.flush()
    slot = SlotTimings(day_of_week_id=day.id, start_time=time(9, 0), end_time=time(9, 30),
                       created_by=doctor.user_id, updated_by=doctor.user_id)
    db.add(slot)
    db.flush()
    db.add(Appointment(user_id=patient_id, doctor_id=doctor.id, visit_type="video",
                       date=date.today(), slot_timing_id=slot.id, status=status))
    db.commit()


def patient_id(db, email):
    return db.query(User).filter_by(email=email).first().id


def setup(client, db):
    group, _ = seed_group_with_videos(db)
    mine_h = auth_headers(client, "mine@example.com")
    other_h = auth_headers(client, "other@example.com")
    mine_fb = make_feedback(client, mine_h, group, remark="knee feels lighter", before=7, after=3)
    other_fb = make_feedback(client, other_h, group, remark="no change", before=5, after=5)
    # Started but never scored or commented: nothing to review.
    make_feedback(client, mine_h, group, remark=None, before=6, after=None)

    doc_user, doctor = make_doctor(db, "dr.a@example.com")
    book(db, patient_id(db, "mine@example.com"), doctor)
    make_doctor(db, "dr.b@example.com")
    make_staff(db, "boss@example.com", "admin")
    return {
        "mine_fb": mine_fb, "other_fb": other_fb,
        "doctor": login(client, "dr.a@example.com"),
        "other_doctor": login(client, "dr.b@example.com"),
        "admin": login(client, "boss@example.com"),
        "patient": mine_h,
    }


def test_doctor_sees_only_their_patients(client, db_session):
    s = setup(client, db_session)
    r = client.get("/api/v1/therapy-feedback/doctor/review", headers=s["doctor"])
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["total"] == 1
    item = data["items"][0]
    assert item["id"] == s["mine_fb"]
    assert item["userFeedback"] == "knee feels lighter"
    assert item["painRelief"] == 4
    assert item["patientName"]
    assert item["programTitle"] == "Wellness & Prevention"

    none = client.get("/api/v1/therapy-feedback/doctor/review", headers=s["other_doctor"])
    assert none.json()["data"]["total"] == 0


def test_doctor_reply_is_limited_to_own_patients(client, db_session):
    s = setup(client, db_session)
    url = "/api/v1/therapy-feedback/{}/doctor-feedback"
    body = {"doctorFeedback": "Keep the 3-minute routine daily."}

    assert client.put(url.format(s["other_fb"]), json=body, headers=s["doctor"]).status_code == 404
    assert client.put(url.format(s["mine_fb"]), json=body, headers=s["other_doctor"]).status_code == 404
    ok = client.put(url.format(s["mine_fb"]), json=body, headers=s["doctor"])
    assert ok.status_code == 200
    assert ok.json()["data"]["doctorFeedback"] == body["doctorFeedback"]

    pending = client.get("/api/v1/therapy-feedback/doctor/review?status=pending", headers=s["doctor"])
    reviewed = client.get("/api/v1/therapy-feedback/doctor/review?status=reviewed", headers=s["doctor"])
    assert pending.json()["data"]["total"] == 0
    assert reviewed.json()["data"]["items"][0]["doctorFeedbackByName"].startswith("Doctor")


def test_empty_reply_is_rejected(client, db_session):
    s = setup(client, db_session)
    r = client.put(f"/api/v1/therapy-feedback/{s['mine_fb']}/doctor-feedback",
                   json={"doctorFeedback": ""}, headers=s["doctor"])
    assert r.status_code in (400, 422)


def test_admin_sees_everyone_and_filters_pending(client, db_session):
    s = setup(client, db_session)
    r = client.get("/api/v1/therapy-feedback/admin/review", headers=s["admin"])
    assert r.json()["data"]["total"] == 2

    client.put(f"/api/v1/therapy-feedback/{s['other_fb']}/admin-feedback",
               json={"adminFeedback": "Asked the clinic to follow up."}, headers=s["admin"])
    pending = client.get("/api/v1/therapy-feedback/admin/review?status=pending", headers=s["admin"])
    assert [i["id"] for i in pending.json()["data"]["items"]] == [s["mine_fb"]]

    one = client.get(
        f"/api/v1/therapy-feedback/admin/review?patientId={patient_id(db_session, 'other@example.com')}",
        headers=s["admin"],
    )
    assert one.json()["data"]["total"] == 1


def test_review_lists_are_staff_only(client, db_session):
    s = setup(client, db_session)
    assert client.get("/api/v1/therapy-feedback/admin/review", headers=s["patient"]).status_code == 403
    assert client.get("/api/v1/therapy-feedback/doctor/review", headers=s["patient"]).status_code == 403
    assert client.get("/api/v1/therapy-feedback/admin/review", headers=s["doctor"]).status_code == 403
