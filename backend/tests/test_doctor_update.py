"""DoctorService.update — the admin "Edit Doctor Details" save path.

Regression cover for the save that failed with a 500 ("Something went wrong"):
the old code wiped and recreated every clinic row on each save, which the
appointments.clinic_id foreign key rejects as soon as any appointment has been
booked at that clinic.
"""

import uuid
from datetime import date, time, timedelta

from app.core.security import hash_password
from app.models.appointment import Appointment
from app.models.award import Award
from app.models.clinic import Clinic
from app.models.day_of_week import DayOfWeek
from app.models.role import Role
from app.models.slot_timings import SlotTimings
from app.models.user import User
from app.services.doctor_service import DoctorService

from tests.test_doctors import seed_doctor


def _admin(db):
    role = db.query(Role).filter_by(name="admin").first()
    admin = User(
        full_name="Admin",
        email=f"admin-{uuid.uuid4().hex[:8]}@test.com",
        password=hash_password("123456"),
        role_id=role.id,
    )
    db.add(admin)
    db.commit()
    return admin


def _clinic(db, doctor, name="Main Clinic", **overrides):
    clinic = Clinic(
        doctor_id=doctor.id,
        name=name,
        address="123 MG Road",
        city="Bangalore",
        **overrides,
    )
    db.add(clinic)
    db.commit()
    return clinic


def _payload(doctor, **overrides):
    """The shape the admin app round-trips (doctor_card fields included)."""
    payload = {
        "id": str(doctor.id),
        "full_name": doctor.user.full_name,
        "email": doctor.user.email,
        "phone": doctor.user.phone,
        "about": doctor.about,
        "education": doctor.education,
        "experience": doctor.experience_years,
        "fee": float(doctor.consultation_fee),
    }
    payload.update(overrides)
    return payload


def test_update_keeps_clinic_that_has_appointments(db_session):
    """Removing a booked clinic deactivates it instead of raising on the FK."""
    doctor = seed_doctor(db_session)
    admin = _admin(db_session)
    clinic = _clinic(db_session, doctor)

    day = DayOfWeek(day_number=1, day="Monday")
    db_session.add(day)
    db_session.flush()
    slot = SlotTimings(
        day_of_week_id=day.id, start_time=time(9, 0), end_time=time(9, 30)
    )
    db_session.add(slot)
    db_session.flush()
    db_session.add(
        Appointment(
            user_id=admin.id,
            doctor_id=doctor.id,
            visit_type="clinic",
            date=date.today() + timedelta(days=1),
            slot_timing_id=slot.id,
            clinic_id=clinic.id,
        )
    )
    db_session.commit()

    updated = DoctorService.update(
        db_session, doctor.id, _payload(doctor, clinics=[]), admin
    )

    assert updated is not None
    db_session.refresh(clinic)
    assert clinic.is_active is False
    # The appointment still resolves its clinic.
    assert db_session.query(Appointment).first().clinic_id == clinic.id


def test_update_deletes_unbooked_clinic(db_session):
    doctor = seed_doctor(db_session)
    admin = _admin(db_session)
    clinic = _clinic(db_session, doctor)

    DoctorService.update(db_session, doctor.id, _payload(doctor, clinics=[]), admin)

    assert db_session.get(Clinic, clinic.id) is None


def test_update_edits_clinic_in_place_and_keeps_its_id(db_session):
    doctor = seed_doctor(db_session)
    admin = _admin(db_session)
    clinic = _clinic(db_session, doctor)
    clinic_id = clinic.id

    DoctorService.update(
        db_session,
        doctor.id,
        _payload(
            doctor,
            clinics=[
                {
                    "id": str(clinic_id),
                    "name": "Renamed Clinic",
                    "address": "9 Church Street",
                    "city": "Bangalore",
                    "latitude": 12.9716,
                    "longitude": 77.5946,
                    "phone": "+91-9876543210",
                    "is_primary": True,
                }
            ],
        ),
        admin,
    )

    rows = db_session.query(Clinic).filter_by(doctor_id=doctor.id).all()
    assert len(rows) == 1
    assert rows[0].id == clinic_id
    assert rows[0].name == "Renamed Clinic"
    assert rows[0].latitude == 12.9716
    assert rows[0].longitude == 77.5946
    assert rows[0].is_primary is True


def test_update_adds_new_clinic_and_coerces_blank_coordinates(db_session):
    doctor = seed_doctor(db_session)
    admin = _admin(db_session)

    DoctorService.update(
        db_session,
        doctor.id,
        _payload(
            doctor,
            clinics=[
                {
                    "name": "New Clinic",
                    "address": "1 Residency Road",
                    "city": "Bangalore",
                    "latitude": "",
                    "longitude": None,
                }
            ],
        ),
        admin,
    )

    clinic = db_session.query(Clinic).filter_by(doctor_id=doctor.id).one()
    assert clinic.name == "New Clinic"
    assert clinic.latitude is None
    assert clinic.longitude is None


def test_update_saves_experience_and_fee_from_the_card_field_names(db_session):
    """The app sends `experience`/`fee`, not `experience_years`/`consultation_fee`."""
    doctor = seed_doctor(db_session)
    admin = _admin(db_session)

    DoctorService.update(
        db_session, doctor.id, _payload(doctor, experience=22, fee=1500), admin
    )

    db_session.refresh(doctor)
    assert doctor.experience_years == 22
    assert float(doctor.consultation_fee) == 1500


def test_update_merges_awards_by_id(db_session):
    doctor = seed_doctor(db_session)
    admin = _admin(db_session)
    award = Award(doctor_id=doctor.id, title="Best Doctor", year=2024)
    db_session.add(award)
    db_session.commit()
    award_id = award.id

    DoctorService.update(
        db_session,
        doctor.id,
        _payload(
            doctor,
            awards=[
                {"id": str(award_id), "title": "Best Doctor 2025", "year": 2025},
                {"title": "Service Award", "issuer": "Health Assoc"},
            ],
        ),
        admin,
    )

    rows = db_session.query(Award).filter_by(doctor_id=doctor.id).all()
    assert len(rows) == 2
    kept = next(r for r in rows if r.id == award_id)
    assert kept.title == "Best Doctor 2025"
    assert kept.year == 2025


def test_update_removes_dropped_awards(db_session):
    doctor = seed_doctor(db_session)
    admin = _admin(db_session)
    db_session.add(Award(doctor_id=doctor.id, title="Old Award"))
    db_session.commit()

    DoctorService.update(db_session, doctor.id, _payload(doctor, awards=[]), admin)

    assert db_session.query(Award).filter_by(doctor_id=doctor.id).count() == 0
