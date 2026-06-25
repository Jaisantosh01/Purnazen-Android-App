from datetime import date
from app.models.user import User
from app.models.role import Role
from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.specialty import Specialty
from app.core.security import hash_password

def setup_admin(db_session, client):
    admin_role = db_session.query(Role).filter_by(name="admin").first()
    user = User(
        full_name="Admin User",
        email="admin_dashboard@example.com",
        password=hash_password("admin123"),
        role_id=admin_role.id,
    )
    db_session.add(user)
    db_session.commit()
    
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin_dashboard@example.com", "password": "admin123"}
    ).json()["data"]
    return {"Authorization": f"Bearer {login_res['access_token']}"}

def test_get_dashboard_stats_success(client, db_session):
    headers = setup_admin(db_session, client)
    
    # Add an active doctor
    specialty = Specialty(name="General")
    db_session.add(specialty)
    db_session.commit()
    
    doctor_user = User(
        full_name="Dr. Test",
        email="doctor_test@example.com",
        password="...",
        role_id=db_session.query(Role).filter_by(name="doctor").first().id
    )
    db_session.add(doctor_user)
    db_session.commit()
    
    doctor = Doctor(
        user_id=doctor_user.id,
        specialty_id=specialty.id,
        experience_years=5,
        consultation_fee=500,
        is_active=True
    )
    db_session.add(doctor)
    db_session.flush()

    # Slot timings the appointments reference (the model links a slot_timing row
    # instead of carrying start/end columns directly).
    from datetime import time, timedelta
    from app.models.day_of_week import DayOfWeek
    from app.models.slot_timings import SlotTimings

    day = DayOfWeek(day_number=1, day="Monday")
    db_session.add(day)
    db_session.flush()

    def make_slot(start, end):
        slot = SlotTimings(
            day_of_week_id=day.id,
            start_time=start,
            end_time=end,
            created_by=doctor_user.id,
            updated_by=doctor_user.id,
        )
        db_session.add(slot)
        db_session.flush()
        return slot

    slot1 = make_slot(time(9, 0), time(9, 30))
    slot2 = make_slot(time(10, 0), time(10, 30))
    slot3 = make_slot(time(11, 0), time(11, 30))

    # 1. Scheduled for today
    db_session.add(Appointment(
        user_id=doctor_user.id, # any user
        doctor_id=doctor.id,
        visit_type="video",
        date=date.today(),
        slot_timing_id=slot1.id,
        status="booked"
    ))
    # 2. Scheduled for tomorrow (not today, but still scheduled)
    db_session.add(Appointment(
        user_id=doctor_user.id,
        doctor_id=doctor.id,
        visit_type="video",
        date=date.today() + timedelta(days=1),
        slot_timing_id=slot2.id,
        status="booked"
    ))
    # 3. Completed (not scheduled)
    db_session.add(Appointment(
        user_id=doctor_user.id,
        doctor_id=doctor.id,
        visit_type="video",
        date=date.today(),
        slot_timing_id=slot3.id,
        status="completed"
    ))

    db_session.commit()
    
    response = client.get("/api/v1/admin/stats", headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]
    
    assert data["total_active_doctors"] == 1
    assert data["scheduled_appointments"] == 2 # booked, booked
    assert data["today_appointments"] == 2 # booked, completed (both are on today's date)
    assert data["total_active_users"] >= 2 # admin + doctor_user
