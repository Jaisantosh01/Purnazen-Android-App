import pytest
from datetime import date, time
import uuid

from app.main import app
from app.models.day_of_week import DayOfWeek
from app.models.role import Role
from app.models.user import User
from app.models.doctor import Doctor
from app.models.specialty import Specialty
from app.models.doctor_speciality_mapping import DoctorSpecialityMapping
from app.models.doctor_availability import DoctorAvailability
from app.models.slot_timings import SlotTimings
from app.models.doctor_leave import DoctorLeave
from app.models.doctor_leave_slot import DoctorLeaveSlot
from app.services.doctor_service import DoctorService
from app.api.deps import get_current_user


def test_leave_blocks_availability(client, db_session):
    # Setup roles
    doctor_role = db_session.query(Role).filter_by(name="doctor").first()
    patient_role = db_session.query(Role).filter_by(name="patient").first()

    # Create doctor user
    doctor_user = User(
        email="doctor@test.com",
        full_name="Dr. Test",
        role_id=doctor_role.id,
        password="hashed_password",
    )
    db_session.add(doctor_user)
    db_session.commit()

    # Create specialty
    specialty = Specialty(name="General")
    db_session.add(specialty)
    db_session.commit()

    # Create doctor profile
    doctor = Doctor(
        user_id=doctor_user.id,
        specialty_id=specialty.id,
        experience_years=5,
        consultation_fee=100,
    )
    db_session.add(doctor)
    db_session.commit()

    # Create Monday day of week
    day = DayOfWeek(day_number=1, day="Monday")
    db_session.add(day)
    db_session.commit()

    # Create slot timing: Monday 09:00 - 10:00
    slot1 = SlotTimings(
        day_of_week_id=day.id,
        start_time=time(9, 0),
        end_time=time(10, 0),
        is_active=True,
    )
    # Create slot timing: Monday 10:00 - 11:00
    slot2 = SlotTimings(
        day_of_week_id=day.id,
        start_time=time(10, 0),
        end_time=time(11, 0),
        is_active=True,
    )
    db_session.add_all([slot1, slot2])
    db_session.commit()

    # Create doctor availability records
    avail1 = DoctorAvailability(
        doctor_id=doctor.id, slot_timing_id=slot1.id, is_active=True
    )
    avail2 = DoctorAvailability(
        doctor_id=doctor.id, slot_timing_id=slot2.id, is_active=True
    )
    db_session.add_all([avail1, avail2])
    db_session.commit()

    # Get slots on a Monday date, e.g. 2026-07-06
    test_date = date(2026, 7, 6)
    slots = DoctorService.get_time_slots(db_session, doctor, test_date)
    assert len(slots) == 2

    # Case 1: Add pending leave - should NOT block slots
    leave_pending = DoctorLeave(
        doctor_id=doctor.id,
        leave_type="single",
        start_date=test_date,
        end_date=test_date,
        status="pending",
        is_active=True,
    )
    db_session.add(leave_pending)
    db_session.commit()

    slots = DoctorService.get_time_slots(db_session, doctor, test_date)
    assert len(slots) == 2

    # Case 2: Add approved partial leave (e.g. single day leave with start/end time blocking slot 1)
    # Let's delete the pending leave first
    db_session.delete(leave_pending)
    db_session.commit()

    leave_approved_partial = DoctorLeave(
        doctor_id=doctor.id,
        leave_type="single",
        start_date=test_date,
        end_date=test_date,
        start_time=time(9, 0),
        end_time=time(10, 0),
        status="approved",
        is_active=True,
    )
    db_session.add(leave_approved_partial)
    db_session.commit()

    slots = DoctorService.get_time_slots(db_session, doctor, test_date)
    assert len(slots) == 1
    assert slots[0]["id"] == str(slot2.id)

    # Try booking slot 1 - should fail
    # Set current user to a patient
    patient_user = User(
        email="patient@test.com",
        full_name="Patient Test",
        role_id=patient_role.id,
        password="hashed_password",
    )
    db_session.add(patient_user)
    db_session.commit()

    def override_get_current_user():
        return patient_user

    app.dependency_overrides[get_current_user] = override_get_current_user

    booking_payload = {
        "doctorId": str(doctor.id),
        "date": test_date.isoformat(),
        "slotTimingId": str(slot1.id),
        "visitType": "consultation",
        "fee": 100,
    }
    response = client.post("/api/v1/appointments/book", json=booking_payload)
    assert response.status_code == 409
    assert "leave" in response.json()["message"].lower()

    # Try booking slot 2 - should succeed (returns 201 Created)
    booking_payload_ok = {
        "doctorId": str(doctor.id),
        "date": test_date.isoformat(),
        "slotTimingId": str(slot2.id),
        "visitType": "consultation",
        "fee": 100,
    }
    response_ok = client.post("/api/v1/appointments/book", json=booking_payload_ok)
    assert response_ok.status_code == 201

    # Clear overrides
    app.dependency_overrides.clear()


def test_get_availability_response_format(client, db_session):
    # Setup roles
    doctor_role = db_session.query(Role).filter_by(name="doctor").first()

    # Create doctor user
    doctor_user = User(
        email="doctor_test@test.com",
        full_name="Dr. Enriched",
        role_id=doctor_role.id,
        password="hashed_password",
    )
    db_session.add(doctor_user)
    db_session.commit()

    # Create specialty
    specialty = Specialty(name="General")
    db_session.add(specialty)
    db_session.commit()

    # Create doctor profile
    doctor = Doctor(
        user_id=doctor_user.id,
        specialty_id=specialty.id,
        experience_years=5,
        consultation_fee=100,
    )
    db_session.add(doctor)
    db_session.commit()

    # Create Monday day of week
    day = DayOfWeek(day_number=1, day="Monday")
    db_session.add(day)
    db_session.commit()

    # Create slot timing: Monday 09:00 - 10:00
    slot1 = SlotTimings(
        day_of_week_id=day.id,
        start_time=time(9, 0),
        end_time=time(10, 0),
        is_active=True,
    )
    db_session.add(slot1)
    db_session.commit()

    # Create doctor availability records
    avail1 = DoctorAvailability(
        doctor_id=doctor.id, slot_timing_id=slot1.id, is_active=True
    )
    db_session.add(avail1)
    db_session.commit()

    def override_get_current_user():
        return doctor_user

    app.dependency_overrides[get_current_user] = override_get_current_user

    response = client.get("/api/v1/doctor-availability")
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) == 1
    item = data[0]

    assert item["availability_id"] == str(avail1.id)
    assert item["doctor_id"] == str(doctor.id)
    assert item["slot_timing_id"] == str(slot1.id)
    assert item["day"] == "Monday"
    assert item["day_of_week_id"] == str(day.id)
    assert item["start_time"] == "09:00:00"
    assert item["end_time"] == "10:00:00"
    assert item["is_active"] is True

    # Clear overrides
    app.dependency_overrides.clear()
