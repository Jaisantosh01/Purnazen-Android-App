"""Seed the database with development data.

Usage:  python seed.py
Creates tables if missing, then inserts idempotent reference + demo data.
"""

from datetime import time

from app.core.security import hash_password
from app.db.base import (
    Base,
    ConsultationType,
    Doctor,
    DoctorAvailability,
    Expertise,
    Language,
    ReliefSession,
    Specialty,
    User,
    WellnessSession,
)
from app.db.session import SessionLocal, engine
from seed_data import RELIEF_SESSIONS, WELLNESS_SESSIONS

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # ------------------------
    # Specialties
    # ------------------------
    specialties = [
        "Acupressure Specialist",
        "Wellness Expert",
        "Pain Management",
    ]

    for name in specialties:
        if not db.query(Specialty).filter_by(name=name).first():
            db.add(Specialty(name=name))

    db.commit()

    # ------------------------
    # Consultation Types
    # ------------------------
    consultation_types = [
        "Video Call",
        "Home Visit",
        "Clinic Visit",
    ]

    for name in consultation_types:
        if not db.query(ConsultationType).filter_by(name=name).first():
            db.add(ConsultationType(name=name))

    db.commit()

    # ------------------------
    # Languages
    # ------------------------
    languages = ["English", "Hindi", "Mandarin", "Kannada"]

    for name in languages:
        if not db.query(Language).filter_by(name=name).first():
            db.add(Language(name=name))

    db.commit()

    # ------------------------
    # Expertise
    # ------------------------
    expertise_list = [
        "Pain Management",
        "Stress Relief",
        "Migraine Treatment",
        "Sports Injuries",
        "Lifestyle Management",
        "Nutrition",
        "Yoga Therapy",
        "Chronic Pain",
        "Back Pain",
        "Joint Pain",
        "Rehabilitation",
    ]

    for name in expertise_list:
        if not db.query(Expertise).filter_by(name=name).first():
            db.add(Expertise(name=name))

    db.commit()

    # ------------------------
    # Doctor users (passwords properly bcrypt-hashed)
    # ------------------------
    doctor_users = [
        ("Dr Sarah Chen", "sarah@example.com"),
        ("Dr Rajesh Kumar", "rajesh@example.com"),
        ("Dr Priya Sharma", "priya@example.com"),
    ]

    for full_name, email in doctor_users:
        if not db.query(User).filter_by(email=email).first():
            db.add(
                User(
                    full_name=full_name,
                    email=email,
                    password=hash_password("123456"),
                    role="doctor",
                )
            )

    db.commit()

    # ------------------------
    # Doctor profiles
    # ------------------------
    sarah = db.query(User).filter_by(email="sarah@example.com").first()
    rajesh = db.query(User).filter_by(email="rajesh@example.com").first()
    priya = db.query(User).filter_by(email="priya@example.com").first()

    acupressure = db.query(Specialty).filter_by(name="Acupressure Specialist").first()
    wellness = db.query(Specialty).filter_by(name="Wellness Expert").first()
    pain = db.query(Specialty).filter_by(name="Pain Management").first()

    doctor_profiles = [
        (sarah, acupressure, "Experienced acupressure specialist.", 15, 1200, 4.9, 234, True),
        (rajesh, wellness, "Wellness and lifestyle expert.", 12, 1000, 4.8, 189, False),
        (priya, pain, "Pain management specialist.", 18, 1500, 4.9, 312, True),
    ]

    for user, specialty, about, years, fee, rating, reviews, available in doctor_profiles:
        if not db.query(Doctor).filter_by(user_id=user.id).first():
            db.add(
                Doctor(
                    user_id=user.id,
                    specialty_id=specialty.id,
                    about=about,
                    education="MBBS, MD",
                    experience_years=years,
                    consultation_fee=fee,
                    average_rating=rating,
                    reviews_count=reviews,
                    is_available_today=available,
                )
            )

    db.commit()

    # ------------------------
    # Doctor ↔ consultation types (drives visit-types + the T6 filter endpoints)
    # ------------------------
    type_links = {
        "sarah@example.com": ["Video Call", "Clinic Visit"],
        "rajesh@example.com": ["Home Visit", "Clinic Visit"],
        "priya@example.com": ["Video Call", "Home Visit", "Clinic Visit"],
    }

    for email, type_names in type_links.items():
        owner = db.query(User).filter_by(email=email).first()
        doctor = db.query(Doctor).filter_by(user_id=owner.id).first() if owner else None
        if not doctor:
            continue
        existing = {ct.name for ct in doctor.consultation_types}
        for type_name in type_names:
            if type_name not in existing:
                consultation_type = (
                    db.query(ConsultationType).filter_by(name=type_name).first()
                )
                doctor.consultation_types.append(consultation_type)

    db.commit()

    # ------------------------
    # Weekly availability (drives /doctors/:id/time-slots)
    # ------------------------
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    windows = [(time(9, 0), time(12, 0)), (time(14, 0), time(17, 0))]

    for user, *_ in doctor_profiles:
        doctor = db.query(Doctor).filter_by(user_id=user.id).first()
        if doctor and not db.query(DoctorAvailability).filter_by(doctor_id=doctor.id).first():
            for day in weekdays:
                for start, end in windows:
                    db.add(
                        DoctorAvailability(
                            doctor_id=doctor.id,
                            day_of_week=day,
                            start_time=start,
                            end_time=end,
                            slot_duration_minutes=30,
                            is_available=True,
                        )
                    )

    db.commit()

    # ------------------------
    # Session catalogs (wellness + relief players)
    # ------------------------
    for sort_order, (key, content) in enumerate(WELLNESS_SESSIONS.items()):
        if not db.query(WellnessSession).filter_by(key=key).first():
            db.add(
                WellnessSession(
                    key=key,
                    title=content["title"],
                    duration_label=content["duration"],
                    icon=content["icon"],
                    video_url=content["videoUrl"],
                    total_cycles=content["totalCycles"],
                    steps=content["steps"],
                    sort_order=sort_order,
                )
            )

    for sort_order, (key, content) in enumerate(RELIEF_SESSIONS.items()):
        if not db.query(ReliefSession).filter_by(key=key).first():
            db.add(
                ReliefSession(
                    key=key,
                    title=content["title"],
                    duration_label=content["duration"],
                    icon=content["icon"],
                    video_url=content["videoUrl"],
                    total_cycles=content["totalCycles"],
                    steps=content["steps"],
                    sort_order=sort_order,
                )
            )

    db.commit()

    print("Seed data inserted successfully.")
finally:
    db.close()
