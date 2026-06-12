from datetime import date, time, timedelta

from app.core.security import hash_password
from app.models.consultation_type import ConsultationType
from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.specialty import Specialty
from app.models.user import User


def seed_doctor(
    db,
    name="Dr Sarah Chen",
    email="sarah@example.com",
    available=True,
    with_types=True,
):
    user = User(
        full_name=name,
        email=email,
        password=hash_password("123456"),
        role="doctor",
    )
    specialty = db.query(Specialty).filter_by(name="Acupressure Specialist").first()
    if not specialty:
        specialty = Specialty(name="Acupressure Specialist")
        db.add(specialty)
    video = db.query(ConsultationType).filter_by(name="Video Call").first()
    if not video:
        video = ConsultationType(name="Video Call")
        db.add(video)
    db.add(user)
    db.commit()

    doctor = Doctor(
        user_id=user.id,
        specialty_id=specialty.id,
        about="Experienced specialist.",
        education="MBBS, MD",
        experience_years=15,
        consultation_fee=1200,
        average_rating=4.9,
        reviews_count=234,
        is_available_today=available,
    )
    if with_types:
        doctor.consultation_types.append(video)
    db.add(doctor)
    db.commit()
    return doctor


def next_weekday(day_name="Monday"):
    """The next future date (at least tomorrow) falling on the given weekday."""
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    target = days.index(day_name)
    today = date.today()
    delta = (target - today.weekday()) % 7 or 7
    return today + timedelta(days=delta)


def add_availability(
    db, doctor, day="Monday", start=time(9, 0), end=time(11, 0), duration=30
):
    db.add(
        DoctorAvailability(
            doctor_id=doctor.id,
            day_of_week=day,
            start_time=start,
            end_time=end,
            slot_duration_minutes=duration,
            is_available=True,
        )
    )
    db.commit()


def test_get_doctors_empty(client):
    response = client.get("/api/v1/doctors")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["doctors"] == []
    assert body["data"]["total"] == 0


def test_get_doctors_returns_card_shape(client, db_session):
    seed_doctor(db_session)
    response = client.get("/api/v1/doctors")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1

    doctor = data["doctors"][0]
    assert doctor["name"] == "Dr. Dr Sarah Chen"
    assert doctor["specialty"] == "Acupressure Specialist"
    assert doctor["rating"] == 4.9
    assert doctor["reviews"] == 234
    assert doctor["experience"] == 15
    assert doctor["fee"] == 1200.0
    assert doctor["availability"] == "Available today"
    assert doctor["availableToday"] is True
    assert doctor["tags"] == ["Video Call"]


def test_get_doctors_search_by_name(client, db_session):
    seed_doctor(db_session, name="Dr Sarah Chen", email="sarah@example.com")
    seed_doctor(db_session, name="Dr Rajesh Kumar", email="rajesh@example.com")

    response = client.get("/api/v1/doctors", params={"search": "rajesh"})
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["doctors"][0]["name"] == "Dr. Dr Rajesh Kumar"


def test_get_doctors_pagination(client, db_session):
    for i in range(3):
        seed_doctor(db_session, name=f"Dr Number {i}", email=f"doc{i}@example.com")

    response = client.get("/api/v1/doctors", params={"page": 2, "limit": 2})
    data = response.json()["data"]
    assert data["total"] == 3
    assert len(data["doctors"]) == 1
    assert data["page"] == 2
    assert data["limit"] == 2


def test_get_doctors_rejects_bad_params(client):
    response = client.get("/api/v1/doctors", params={"page": 0})
    assert response.status_code == 400
    assert response.json()["success"] is False


# ── T1: doctor detail ────────────────────────────────────────────────────────


def test_get_doctor_detail_returns_card_shape(client, db_session):
    doctor = seed_doctor(db_session)
    response = client.get(f"/api/v1/doctors/{doctor.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True

    data = body["data"]
    assert data["id"] == str(doctor.id)
    assert data["name"] == "Dr. Dr Sarah Chen"
    assert data["specialty"] == "Acupressure Specialist"
    assert data["fee"] == 1200.0
    assert data["experience"] == 15
    assert data["about"] == "Experienced specialist."
    assert data["education"] == "MBBS, MD"
    assert data["tags"] == ["Video Call"]
    assert data["expertise"] == []
    assert data["languages"] == []
    assert data["awards"] == []


def test_get_doctor_detail_not_found(client):
    response = client.get("/api/v1/doctors/999")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["message"] == "Doctor not found"


# ── T2: visit types ──────────────────────────────────────────────────────────


def test_get_visit_types(client, db_session):
    doctor = seed_doctor(db_session)
    response = client.get(f"/api/v1/doctors/{doctor.id}/visit-types")
    assert response.status_code == 200

    visit_types = response.json()["data"]["visitTypes"]
    assert len(visit_types) == 1
    assert visit_types[0]["id"] == "video"
    assert visit_types[0]["title"] == "Video Consultation"
    assert visit_types[0]["icon"] == "📹"
    assert visit_types[0]["fee"] == 1200.0


def test_get_visit_types_doctor_without_types(client, db_session):
    doctor = seed_doctor(db_session, with_types=False)
    response = client.get(f"/api/v1/doctors/{doctor.id}/visit-types")
    assert response.status_code == 200
    assert response.json()["data"]["visitTypes"] == []


def test_get_visit_types_doctor_not_found(client):
    response = client.get("/api/v1/doctors/999/visit-types")
    assert response.status_code == 404


# ── T3: time slots ───────────────────────────────────────────────────────────


def test_get_time_slots_from_availability(client, db_session):
    doctor = seed_doctor(db_session)
    add_availability(db_session, doctor, day="Monday", start=time(9, 0), end=time(11, 0))
    on_date = next_weekday("Monday")

    response = client.get(
        f"/api/v1/doctors/{doctor.id}/time-slots",
        params={"date": on_date.isoformat()},
    )
    assert response.status_code == 200
    assert response.json()["data"]["slots"] == [
        "09:00 AM",
        "09:30 AM",
        "10:00 AM",
        "10:30 AM",
    ]


def test_get_time_slots_empty_day(client, db_session):
    doctor = seed_doctor(db_session)
    add_availability(db_session, doctor, day="Monday")
    on_date = next_weekday("Tuesday")

    response = client.get(
        f"/api/v1/doctors/{doctor.id}/time-slots",
        params={"date": on_date.isoformat()},
    )
    assert response.status_code == 200
    assert response.json()["data"]["slots"] == []


def test_get_time_slots_invalid_date(client, db_session):
    doctor = seed_doctor(db_session)
    response = client.get(
        f"/api/v1/doctors/{doctor.id}/time-slots", params={"date": "not-a-date"}
    )
    assert response.status_code == 400
    assert response.json()["success"] is False


def test_get_time_slots_past_date(client, db_session):
    doctor = seed_doctor(db_session)
    yesterday = date.today() - timedelta(days=1)
    response = client.get(
        f"/api/v1/doctors/{doctor.id}/time-slots",
        params={"date": yesterday.isoformat()},
    )
    assert response.status_code == 400
    assert response.json()["message"] == "Date must not be in the past"
