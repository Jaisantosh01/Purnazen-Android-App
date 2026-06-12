from flask import jsonify, request

from app.services.doctor_service import (
    DoctorService
)


def get_doctors():


    page = request.args.get(
        "page",
        default=1,
        type=int
    )

    limit = request.args.get(
        "limit",
        default=10,
        type=int
    )

    search = request.args.get(
        "search",
        default="",
        type=str
    )

    doctors, total = DoctorService.get_doctors(
        page,
        limit,
        search
    )
    
    response = []

    for doctor in doctors:

        response.append({
        "id": str(doctor.id),
        "name": f"Dr. {doctor.user.full_name}",
        "specialty": doctor.specialty.name,
        "avatar": doctor.user.avatar_url or "👨‍⚕️",
        "rating": float(doctor.average_rating),
        "reviews": doctor.reviews_count,
        "experience": doctor.experience_years,
        "location": "",  # Add location field later if available
        "tags": [
            consultation.name
            for consultation in doctor.consultation_types
        ],
        "fee": float(doctor.consultation_fee),
        "availability": (
            "Available today"
            if doctor.is_available_today
            else "Not Available"
        ),
        "availableToday": doctor.is_available_today,
        "about": doctor.about,
        "education": doctor.education,
        "expertise": [
            expertise.name
            for expertise in doctor.expertises
        ],
        "languages": [
            language.name
            for language in doctor.languages
        ],
        "awards": [
            award.name
            for award in doctor.awards
        ]
    })

    return jsonify({
        "success": True,
        "data": {
            "doctors": response,
            "total": total,
            "page": page,
            "limit": limit
        }
    })