from app import create_app
from app.extensions.database import db

from app.models.specialty_model import Specialty
from app.models.consultation_type_model import ConsultationType
from app.models.language_model import Language
from app.models.expertise_model import Expertise
from app.models.user_model import User
from app.models.doctor_model import Doctor

app = create_app()

with app.app_context():

    # ------------------------
    # Specialties
    # ------------------------

    specialties = [
        "Acupressure Specialist",
        "Wellness Expert",
        "Pain Management"
    ]

    for name in specialties:
        if not Specialty.query.filter_by(name=name).first():
            db.session.add(
                Specialty(name=name)
            )

    db.session.commit()

    # ------------------------
    # Consultation Types
    # ------------------------

    consultation_types = [
        "Video Call",
        "Home Visit",
        "Clinic Visit"
    ]

    for name in consultation_types:
        if not ConsultationType.query.filter_by(name=name).first():
            db.session.add(
                ConsultationType(name=name)
            )

    db.session.commit()

    # ------------------------
    # Languages
    # ------------------------

    languages = [
        "English",
        "Hindi",
        "Mandarin",
        "Kannada"
    ]

    for name in languages:
        if not Language.query.filter_by(name=name).first():
            db.session.add(
                Language(name=name)
            )

    db.session.commit()

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
        "Rehabilitation"
    ]

    for name in expertise_list:
        if not Expertise.query.filter_by(name=name).first():
            db.session.add(
                Expertise(name=name)
            )

    db.session.commit()

    # ------------------------
    # Users
    # ------------------------

    if not User.query.filter_by(
        email="sarah@example.com"
    ).first():

        user = User(
            full_name="Dr Sarah Chen",
            email="sarah@example.com",
            password="123456",
            role="doctor"
        )

        db.session.add(user)

    if not User.query.filter_by(
        email="rajesh@example.com"
    ).first():

        user = User(
            full_name="Dr Rajesh Kumar",
            email="rajesh@example.com",
            password="123456",
            role="doctor"
        )

        db.session.add(user)

    if not User.query.filter_by(
        email="priya@example.com"
    ).first():

        user = User(
            full_name="Dr Priya Sharma",
            email="priya@example.com",
            password="123456",
            role="doctor"
        )

        db.session.add(user)

    db.session.commit()

    # ------------------------
    # Doctors
    # ------------------------

    sarah = User.query.filter_by(
        email="sarah@example.com"
    ).first()

    rajesh = User.query.filter_by(
        email="rajesh@example.com"
    ).first()

    priya = User.query.filter_by(
        email="priya@example.com"
    ).first()

    acupressure = Specialty.query.filter_by(
        name="Acupressure Specialist"
    ).first()

    wellness = Specialty.query.filter_by(
        name="Wellness Expert"
    ).first()

    pain = Specialty.query.filter_by(
        name="Pain Management"
    ).first()

    if not Doctor.query.filter_by(
        user_id=sarah.id
    ).first():

        db.session.add(
            Doctor(
                user_id=sarah.id,
                specialty_id=acupressure.id,
                about="Experienced acupressure specialist.",
                education="MBBS, MD",
                experience_years=15,
                consultation_fee=1200,
                average_rating=4.9,
                reviews_count=234,
                is_available_today=True
            )
        )

    if not Doctor.query.filter_by(
        user_id=rajesh.id
    ).first():

        db.session.add(
            Doctor(
                user_id=rajesh.id,
                specialty_id=wellness.id,
                about="Wellness and lifestyle expert.",
                education="MBBS, MD",
                experience_years=12,
                consultation_fee=1000,
                average_rating=4.8,
                reviews_count=189,
                is_available_today=False
            )
        )

    if not Doctor.query.filter_by(
        user_id=priya.id
    ).first():

        db.session.add(
            Doctor(
                user_id=priya.id,
                specialty_id=pain.id,
                about="Pain management specialist.",
                education="MBBS, MD",
                experience_years=18,
                consultation_fee=1500,
                average_rating=4.9,
                reviews_count=312,
                is_available_today=True
            )
        )

    db.session.commit()

    print("Seed data inserted successfully.")