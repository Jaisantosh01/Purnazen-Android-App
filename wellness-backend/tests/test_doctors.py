from app.core.security import hash_password
from app.models.consultation_type import ConsultationType
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.models.user import User


def seed_doctor(db, name="Dr Sarah Chen", email="sarah@example.com", available=True):
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
    doctor.consultation_types.append(video)
    db.add(doctor)
    db.commit()
    return doctor


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
