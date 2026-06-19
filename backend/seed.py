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
    Role,
    Specialty,
    User,
    WellnessSession,
    VideoGroups,
    Videos,
    VideoGroupMapping,
    ChatQuestion,
    ChatOption,
    QuickRelief,
    Award,
    DayOfWeek,
    SlotTimings
)
from app.db.session import SessionLocal, engine
from seed_data import RELIEF_SESSIONS, VIDEO_GROUPS, VIDEOS, CHAT_FLOW, QUICK_RELIEFS, AWARDS, DAYS_OF_WEEK, SLOT_TIMINGS, WELLNESS_SESSIONS_DATA

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # ------------------------
    # Roles
    # ------------------------
    roles_data = [
        {"name": "admin", "icon": "shield-account"},
        {"name": "doctor", "icon": "doctor"},
        {"name": "patient", "icon": "account-heart"},
    ]
    for role in roles_data:
        existing_role = db.query(Role).filter_by(name=role["name"]).first()
        if not existing_role:
            db.add(Role(name=role["name"], icon=role["icon"]))
        elif not existing_role.icon:
            # Update existing role if icon is missing
            existing_role.icon = role["icon"]
            
    db.commit()

    admin_role = db.query(Role).filter_by(name="admin").first()
    doctor_role = db.query(Role).filter_by(name="doctor").first()
    patient_role = db.query(Role).filter_by(name="patient").first()

    # ------------------------
    # Admin & Doctor users
    # ------------------------
    if not db.query(User).filter_by(email="admin@example.com").first():
        db.add(
            User(
                full_name="Admin User",
                email="admin@example.com",
                password=hash_password("admin123"),
                role_id=admin_role.id,
            )
        )
    
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
                    role_id=doctor_role.id,
                )
            )

    db.commit()
    admin = db.query(User).filter_by(email="admin@example.com").first()

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
    # Doctor ↔ consultation types
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
    # Days of Week
    # ------------------------
    for day_data in DAYS_OF_WEEK:
        if not db.query(DayOfWeek).filter_by(day_number=day_data["day_number"]).first():
            db.add(DayOfWeek(day_number=day_data["day_number"], day=day_data["day"]))

    db.commit()

    # ------------------------
    # Slot Timings
    # ------------------------
    for slot_data in SLOT_TIMINGS:
        day_of_week = db.query(DayOfWeek).filter_by(day_number=slot_data["day_number"]).first()
        if day_of_week:
            start_time = time.fromisoformat(slot_data["start_time"])
            end_time = time.fromisoformat(slot_data["end_time"])
            
            if not db.query(SlotTimings).filter_by(
                day_of_week_id=day_of_week.id,
                start_time=start_time,
                end_time=end_time
            ).first():
                db.add(SlotTimings(
                    day_of_week_id=day_of_week.id,
                    start_time=start_time,
                    end_time=end_time,
                    created_by=admin.id,
                    updated_by=admin.id
                ))

    db.commit()

    # ------------------------
    # Weekly availability (links doctors to slot_timings)
    # ------------------------
    windows = [(time(9, 0), time(12, 0)), (time(14, 0), time(17, 0))]
    day_map = {d.day: d for d in db.query(DayOfWeek).all()}

    for user, *_ in doctor_profiles:
        doctor = db.query(Doctor).filter_by(user_id=user.id).first()
        if doctor and not db.query(DoctorAvailability).filter_by(doctor_id=doctor.id).first():
            for day_name in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]:
                dow = day_map.get(day_name)
                if not dow:
                    continue
                for window_start, window_end in windows:
                    slots = db.query(SlotTimings).filter(
                        SlotTimings.day_of_week_id == dow.id,
                        SlotTimings.start_time >= window_start,
                        SlotTimings.end_time <= window_end,
                    ).all()
                    for slot in slots:
                        db.add(DoctorAvailability(
                            doctor_id=doctor.id,
                            slot_timing_id=slot.id,
                            is_active=True,
                        ))

    db.commit()

    # ------------------------
    # Video Groups
    # ------------------------
    for group_data in VIDEO_GROUPS:
        if not db.query(VideoGroups).filter_by(title=group_data["title"]).first():
            db.add(
                VideoGroups(
                    title=group_data["title"],
                    description=group_data["description"],
                    icon=group_data["icon"],
                    sort_order=group_data["sort_order"],
                    created_by=admin.id,
                    updated_by=admin.id
                )
            )
    db.commit()

    # ------------------------
    # Videos & Mappings
    # ------------------------
    for video_data in VIDEOS:
        if not db.query(Videos).filter_by(title=video_data["title"]).first():
            video = Videos(
                title=video_data["title"],
                description=video_data["description"],
                duration=video_data["duration"],
                icon=video_data["icon"],
                video_url=video_data["video_url"],
                created_by=admin.id,
                updated_by=admin.id
            )
            db.add(video)
            db.flush()

            group = db.query(VideoGroups).filter_by(title=video_data["group_title"]).first()
            if group:
                db.add(
                    VideoGroupMapping(
                        video_group_id=group.id,
                        video_id=video.id,
                        sort_order=video_data["sort_order"],
                        created_by=admin.id,
                        updated_by=admin.id
                    )
                )
    db.commit()

    # ------------------------
    # Chat Flow
    # ------------------------
    question_map = {}
    for q_data in CHAT_FLOW:
        q_text = q_data["question"]
        question = db.query(ChatQuestion).filter_by(question_text=q_text).first()
        if not question:
            question = ChatQuestion(
                question_text=q_text,
                is_start=q_data["is_start"],
                created_by=admin.id,
                updated_by=admin.id
            )
            db.add(question)
            db.flush()
        question_map[q_text] = question

    for q_data in CHAT_FLOW:
        question = question_map[q_data["question"]]
        for opt_data in q_data["options"]:
            next_q_id = None
            if opt_data.get("next_question"):
                next_q_id = question_map[opt_data["next_question"]].id

            v_group_id = None
            if opt_data.get("video_group_key"):
                group = db.query(VideoGroups).filter_by(title=opt_data["video_group_key"]).first()
                v_group_id = group.id if group else None

            existing = db.query(ChatOption).filter_by(
                question_id=question.id, option_text=opt_data["text"]
            ).first()
            if existing:
                existing.next_question_id = next_q_id
                existing.video_group_id = v_group_id
            else:
                db.add(
                    ChatOption(
                        question_id=question.id,
                        option_text=opt_data["text"],
                        next_question_id=next_q_id,
                        video_group_id=v_group_id
                    )
                )
    db.commit()

    # ------------------------
    # Quick Reliefs
    # ------------------------
    for qr_data in QUICK_RELIEFS:
        existing_qr = db.query(QuickRelief).filter_by(slug=qr_data["slug"]).first()
        
        q_id = None
        if qr_data.get("chat_question"):
            question = db.query(ChatQuestion).filter_by(question_text=qr_data["chat_question"]).first()
            q_id = question.id if question else None
        
        if not existing_qr:
            db.add(
                QuickRelief(
                    name=qr_data["name"],
                    slug=qr_data["slug"],
                    title=qr_data["title"],
                    subtitle=qr_data["subtitle"],
                    chat_question_id=q_id,
                    icon_name=qr_data["icon_name"],
                    background_color=qr_data["background_color"],
                    text_color=qr_data["text_color"],
                    sort_order=qr_data["sort_order"]
                )
            )
        else:
            # Update existing to link to chat and ensure all styling is fresh
            existing_qr.chat_question_id = q_id
            existing_qr.title = qr_data["title"]
            existing_qr.subtitle = qr_data["subtitle"]
            existing_qr.icon_name = qr_data["icon_name"]
            existing_qr.background_color = qr_data["background_color"]
            existing_qr.text_color = qr_data["text_color"]
            existing_qr.sort_order = qr_data["sort_order"]
    db.commit()

    # ------------------------
    # Session catalogs
    # ------------------------
    for session_data in WELLNESS_SESSIONS_DATA:
        if not db.query(WellnessSession).filter_by(title=session_data["title"]).first():
            group = db.query(VideoGroups).filter_by(title=session_data["video_group_title"]).first()
            db.add(
                WellnessSession(
                    title=session_data["title"],
                    duration=session_data["duration"],
                    icon=session_data["icon"],
                    sort_order=session_data["sort_order"],
                    video_group_id=group.id if group else None,
                    created_by=admin.id,
                    updated_by=admin.id
                )
            )

    for sort_order, (key, content) in enumerate(RELIEF_SESSIONS.items()):
        if not db.query(ReliefSession).filter_by(key=key).first():
            db.add(
                ReliefSession(
                    key=key,
                    title=content["title"],
                    duration=content["duration"],
                    icon=content["icon"],
                    video_url=content["videoUrl"],
                    total_cycles=content["totalCycles"],
                    steps=content["steps"],
                    sort_order=sort_order,
                )
            )

    # ------------------------
    # Awards
    # ------------------------
    for award_data in AWARDS:
        user = db.query(User).filter_by(email=award_data["doctor_email"]).first()
        if user:
            doctor = db.query(Doctor).filter_by(user_id=user.id).first()
            if doctor:
                if not db.query(Award).filter_by(doctor_id=doctor.id, title=award_data["title"]).first():
                    db.add(
                        Award(
                            doctor_id=doctor.id,
                            title=award_data["title"],
                            issuer=award_data["issuer"],
                            year=award_data["year"],
                            description=award_data["description"],
                            created_by=admin.id,
                            updated_by=admin.id
                        )
                    )

    db.commit()
    print("Seed data inserted successfully.")
finally:
    db.close()
