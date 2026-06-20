import uuid
from datetime import date, datetime, time, timedelta

from app.core.security import hash_password
from app.models.associations import DoctorConsultationType
from app.models.consultation_type import ConsultationType
from app.models.day_of_week import DayOfWeek
from app.models.doctor import Doctor
from app.models.doctor_availability import DoctorAvailability
from app.models.doctor_speciality_mapping import DoctorSpecialityMapping
from app.models.role import Role
from app.models.slot_timings import SlotTimings
from app.models.specialty import Specialty
from app.models.user import User

_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def seed_doctor(
    db,
    name="Dr Sarah Chen",
    email="sarah@example.com",
    available=True,
    with_types=True,
    types=("Video Call",),
    rating=4.9,
):
    doctor_role = db.query(Role).filter_by(name="doctor").first()
    user = User(
        full_name=name,
        email=email,
        password=hash_password("123456"),
        role_id=doctor_role.id if doctor_role else None,
    )
    specialty = db.query(Specialty).filter_by(name="Acupressure Specialist").first()
    if not specialty:
        specialty = Specialty(name="Acupressure Specialist")
        db.add(specialty)
    db.add(user)
    db.flush()

    doctor = Doctor(
        user_id=user.id,
        specialty_id=specialty.id,
        about="Experienced specialist.",
        education="MBBS, MD",
        experience_years=15,
        consultation_fee=1200,
        average_rating=rating,
        reviews_count=234,
        is_available_today=available,
    )
    db.add(doctor)
    db.flush()

    # The doctor card derives specialties from the speciality mapping table.
    db.add(
        DoctorSpecialityMapping(
            doctor_id=doctor.id,
            speciality_id=specialty.id,
            created_by=user.id,
            updated_by=user.id,
        )
    )

    if with_types:
        for type_name in types:
            consultation_type = (
                db.query(ConsultationType).filter_by(name=type_name).first()
            )
            if not consultation_type:
                consultation_type = ConsultationType(name=type_name)
                db.add(consultation_type)
                db.flush()
            doctor.consultation_type_links.append(
                DoctorConsultationType(consultation_type=consultation_type)
            )
    db.commit()
    return doctor


def next_weekday(day_name="Monday"):
    """The next future date (at least tomorrow) falling on the given weekday."""
    target = _DAYS.index(day_name)
    today = date.today()
    delta = (target - today.weekday()) % 7 or 7
    return today + timedelta(days=delta)


def add_availability(
    db, doctor, day="Monday", start=time(9, 0), end=time(11, 0), duration=30
):
    """Create the doctor's weekly availability as discrete slot_timings rows.

    The model now links a doctor to ``SlotTimings`` (one bookable block each)
    via ``doctor_availability``; this splits [start, end) into ``duration``-minute
    slots under the matching ``DayOfWeek``. Returns the created SlotTimings rows.
    """
    day_row = db.query(DayOfWeek).filter_by(day=day).first()
    if not day_row:
        day_row = DayOfWeek(day_number=_DAYS.index(day) + 1, day=day)
        db.add(day_row)
        db.flush()

    slots = []
    cursor = datetime.combine(date.today(), start)
    end_dt = datetime.combine(date.today(), end)
    step = timedelta(minutes=duration)
    while cursor + step <= end_dt:
        slot = SlotTimings(
            day_of_week_id=day_row.id,
            start_time=cursor.time(),
            end_time=(cursor + step).time(),
            created_by=doctor.user_id,
            updated_by=doctor.user_id,
        )
        db.add(slot)
        db.flush()
        db.add(
            DoctorAvailability(
                doctor_id=doctor.id,
                slot_timing_id=slot.id,
                is_active=True,
                created_by=doctor.user_id,
                updated_by=doctor.user_id,
            )
        )
        slots.append(slot)
        cursor += step
    db.commit()
    return slots


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
    assert doctor["specialties"] == ["Acupressure Specialist"]
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


# ── T6: filter endpoints ─────────────────────────────────────────────────────


def test_filter_available_today(client, db_session):
    seed_doctor(db_session, name="Dr Here", email="here@example.com", available=True)
    seed_doctor(db_session, name="Dr Away", email="away@example.com", available=False)

    response = client.get("/api/v1/doctors/available-today")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["doctors"][0]["name"] == "Dr. Dr Here"


def test_filter_video_call(client, db_session):
    seed_doctor(
        db_session, name="Dr Video", email="video@example.com", types=("Video Call",)
    )
    seed_doctor(
        db_session, name="Dr House", email="house@example.com", types=("Home Visit",)
    )

    response = client.get("/api/v1/doctors/video-call")
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["doctors"][0]["name"] == "Dr. Dr Video"


def test_filter_home_visit(client, db_session):
    seed_doctor(
        db_session, name="Dr Video", email="video@example.com", types=("Video Call",)
    )
    seed_doctor(
        db_session,
        name="Dr House",
        email="house@example.com",
        types=("Home Visit", "Video Call"),
    )

    response = client.get("/api/v1/doctors/home-visit")
    data = response.json()["data"]
    assert data["total"] == 1
    assert data["doctors"][0]["name"] == "Dr. Dr House"


def test_filter_top_rated_orders_by_rating(client, db_session):
    seed_doctor(db_session, name="Dr Good", email="good@example.com", rating=4.6)
    seed_doctor(db_session, name="Dr Best", email="best@example.com", rating=5.0)
    seed_doctor(db_session, name="Dr Meh", email="meh@example.com", rating=4.2)

    response = client.get("/api/v1/doctors/top-rated")
    data = response.json()["data"]
    assert data["total"] == 2
    assert [d["name"] for d in data["doctors"]] == ["Dr. Dr Best", "Dr. Dr Good"]


def test_filter_supports_search_and_pagination(client, db_session):
    for index in range(3):
        seed_doctor(
            db_session,
            name=f"Dr Avail {index}",
            email=f"avail{index}@example.com",
            available=True,
        )

    response = client.get(
        "/api/v1/doctors/available-today", params={"page": 2, "limit": 2}
    )
    data = response.json()["data"]
    assert data["total"] == 3
    assert len(data["doctors"]) == 1

    response = client.get(
        "/api/v1/doctors/available-today", params={"search": "Avail 1"}
    )
    assert response.json()["data"]["total"] == 1


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
    assert data["specialties"] == ["Acupressure Specialist"]
    assert data["fee"] == 1200.0
    assert data["experience"] == 15
    assert data["about"] == "Experienced specialist."
    assert data["education"] == "MBBS, MD"
    assert data["tags"] == ["Video Call"]
    assert data["expertise"] == []
    assert data["languages"] == []
    assert data["awards"] == []


def test_get_doctor_detail_not_found(client):
    response = client.get(f"/api/v1/doctors/{uuid.uuid4()}")
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
    response = client.get(f"/api/v1/doctors/{uuid.uuid4()}/visit-types")
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
    slots = response.json()["data"]["slots"]
    assert [s["time"] for s in slots] == [
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
