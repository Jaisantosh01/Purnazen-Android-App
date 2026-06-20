import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.day_of_week import DayOfWeek
from app.models.user import User
from app.api.deps import get_current_user

def test_create_slot_timing(client, db_session):
    # Need to add a day to db_session manually since conftest only adds roles
    day = DayOfWeek(day_number=1, day="Monday")
    db_session.add(day)
    db_session.commit()
    
    # Create a mock admin user
    user = User(email="test@admin.com", full_name="Admin", role_id=1, password="hashed_password") # Assuming role_id 1 is admin
    db_session.add(user)
    db_session.commit()

    # Override get_current_user to return this mock user
    def override_get_current_user():
        return user
    
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    payload = {
        "day_of_week_id": str(day.id),
        "start_time": "09:00:00",
        "end_time": "10:00:00"
    }
    
    response = client.post(
        "/api/v1/slot-timings",
        json=payload
    )
    
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.json()}")
    
    # Clear overrides
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
