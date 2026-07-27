import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.api.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.doctor import Doctor
from app.models.appointment import Appointment
from app.models.face_scan import FaceScan
from app.models.scan_result import ScanResult
from app.models.scan_recommendation import ScanRecommendation
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", summary="Get all unique patients for the logged-in doctor")
def get_patients(
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        return error_response("Doctor profile not found", 404)

    # Fetch unique users who have appointments with this doctor
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.user))
        .filter(Appointment.doctor_id == doctor.id)
        .all()
    )

    # Group by user to get unique patients and compute statistics
    patient_map = {}
    for appt in appointments:
        if not appt.user:
            continue
        p_id = str(appt.user.id)
        
        # We only care about completed or booked appointments
        is_valid_visit = appt.status in ["completed", "booked"]
        
        if p_id not in patient_map:
            patient_map[p_id] = {
                "id": p_id,
                "name": appt.user.full_name,
                "gender": appt.user.gender or "N/A",
                "age": appt.user.age,
                "ageStr": f"{appt.user.age} Years" if appt.user.age else "N/A",
                # `.avatar`, not the raw `.avatar_url` column: the column holds a
                # blob path, and only the property resolves it to a fetchable
                # SAS URL (social-login URLs pass through untouched).
                "avatarUrl": appt.user.avatar,
                "totalConsultations": 1 if appt.status == "completed" else 0,
                "lastVisit": appt.date.strftime("%d %b %Y") if is_valid_visit else None,
                "lastVisitDate": appt.date if is_valid_visit else None,
                "isRecent": True if appt.status in ["booked", "pending"] else False
            }
        else:
            p_data = patient_map[p_id]
            if appt.status == "completed":
                p_data["totalConsultations"] += 1
            if is_valid_visit:
                if not p_data["lastVisitDate"] or appt.date > p_data["lastVisitDate"]:
                    p_data["lastVisitDate"] = appt.date
                    p_data["lastVisit"] = appt.date.strftime("%d %b %Y")

    # Final formatting
    patients_list = []
    for p_id, p_data in patient_map.items():
        p_data.pop("lastVisitDate", None)
        if not p_data["lastVisit"]:
            p_data["lastVisit"] = "N/A"
        patients_list.append(p_data)

    return success_response("Patients fetched successfully", patients_list)


@router.get("/{patient_id}", summary="Get patient details")
def get_patient_detail(
    patient_id: uuid.UUID,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    patient_user = db.get(User, patient_id)
    if not patient_user:
        return error_response("Patient not found", 404)

    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        return error_response("Doctor profile not found", 404)

    # Compute statistics for this patient with this doctor
    completed_appts = (
        db.query(Appointment)
        .filter(
            Appointment.user_id == patient_id,
            Appointment.doctor_id == doctor.id,
            Appointment.status == "completed"
        )
        .all()
    )

    last_visit_appt = (
        db.query(Appointment)
        .filter(
            Appointment.user_id == patient_id,
            Appointment.doctor_id == doctor.id,
            Appointment.status.in_(["completed", "booked"])
        )
        .order_by(Appointment.date.desc())
        .first()
    )

    total_consultations = len(completed_appts)
    last_visit = last_visit_appt.date.strftime("%d %b %Y") if last_visit_appt else "N/A"

    payload = {
        "id": str(patient_user.id),
        "name": patient_user.full_name,
        "age": patient_user.age,
        "ageStr": f"{patient_user.age} Years" if patient_user.age else "N/A",
        "gender": patient_user.gender or "N/A",
        "phone": patient_user.phone or "N/A",
        "email": patient_user.email,
        "avatarUrl": patient_user.avatar,
        "totalConsultations": total_consultations,
        "lastVisit": last_visit
    }

    return success_response("Patient details fetched successfully", payload)


@router.get("/{patient_id}/consultations", summary="Get completed consultations for patient")
def get_patient_consultations(
    patient_id: uuid.UUID,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
    if not doctor:
        return error_response("Doctor profile not found", 404)

    appts = (
        db.query(Appointment)
        .filter(
            Appointment.user_id == patient_id,
            Appointment.doctor_id == doctor.id,
            Appointment.status == "completed"
        )
        .order_by(Appointment.date.desc())
        .all()
    )

    serialized = []
    for a in appts:
        serialized.append({
            "id": str(a.id),
            "date": a.date.strftime("%d %b %Y"),
            "time": a.slot_timing.start_time.strftime("%I:%M %p") if a.slot_timing else "N/A",
            "visitType": a.consultation_type.name if a.consultation_type else a.visit_type,
            "status": a.status,
            "doctorNotes": a.doctor_description or "N/A",
            "diagnosis": "N/A", # TODO: Field diagnosis not implemented in backend DB
            "prescription": "N/A" # TODO: Field prescription not implemented in backend DB
        })

    return success_response("Patient consultations fetched successfully", serialized)


@router.get("/{patient_id}/prescriptions", summary="Get prescriptions for patient")
def get_patient_prescriptions(
    patient_id: uuid.UUID,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    # TODO: Backend database has no table/model for prescriptions.
    # Return empty list and let frontend handle it gracefully.
    return success_response("Patient prescriptions fetched (Backend stub)", [])


@router.get("/{patient_id}/face-glow/history", summary="Get patient face/tongue scan history")
def get_patient_scan_history(
    patient_id: uuid.UUID,
    scan_type: str = Query("face", pattern="^(face|tongue)$"),
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    scans = (
        db.query(FaceScan)
        .filter(FaceScan.user_id == patient_id, FaceScan.scan_type == scan_type)
        .order_by(FaceScan.created_at.desc())
        .all()
    )

    items = []
    for scan in scans:
        result = db.query(ScanResult).filter(ScanResult.scan_id == scan.id).first()
        
        if scan_type == "face":
            items.append({
                "id": str(scan.id),
                "date": scan.created_at.strftime("%d %b %Y") if scan.created_at else "N/A",
                "score": int(result.glow_score) if result and result.glow_score is not None else 0,
                "condition": result.raw_metrics.get("condition") if result and result.raw_metrics else "N/A",
                "status": scan.status
            })
        else:
            items.append({
                "id": str(scan.id),
                "date": scan.created_at.strftime("%d %b %Y") if scan.created_at else "N/A",
                "result": result.tongue_shape or "N/A",
                "moisture": result.tongue_moisture or "N/A",
                "status": scan.status
            })

    return success_response("Patient scan history fetched successfully", items)


@router.get("/{patient_id}/scan/{scan_id}/report", summary="Get full report for a scan")
def get_patient_scan_report(
    patient_id: uuid.UUID,
    scan_id: uuid.UUID,
    user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    scan = db.get(FaceScan, scan_id)
    if not scan or scan.user_id != patient_id:
        raise HTTPException(status_code=404, detail="Scan not found")

    result = db.query(ScanResult).filter(ScanResult.scan_id == scan_id).first()
    recs = db.query(ScanRecommendation).filter(ScanRecommendation.scan_id == scan_id).all()

    recommendations_list = [r.title for r in recs]
    if not recommendations_list:
        recommendations_list = ["No specific recommendations."]

    if scan.scan_type == "face":
        payload = {
            "id": str(scan.id),
            "date": scan.created_at.strftime("%d %b %Y") if scan.created_at else "N/A",
            "overallScore": int(result.overall_wellness_score) if result and result.overall_wellness_score is not None else 0,
            "status": "Good" if (result and result.overall_wellness_score and result.overall_wellness_score >= 80) else "Fair",
            "skinAge": f"{result.skin_age_estimate} Years" if result and result.skin_age_estimate else "N/A",
            "hydration": f"{int(result.hydration_score)}%" if result and result.hydration_score is not None else "N/A",
            "oilLevel": f"{int(result.oiliness_score)}%" if result and result.oiliness_score is not None else "N/A",
            "pigmentation": f"{int(result.pigmentation_score)}%" if result and result.pigmentation_score is not None else "N/A",
            "darkCircles": f"{int(result.dark_circle_score)}%" if result and result.dark_circle_score is not None else "N/A",
            "fineLines": f"{int(result.wrinkle_score)}%" if result and result.wrinkle_score is not None else "N/A",
            "acne": f"{int(result.inflammation_score)}%" if result and result.inflammation_score is not None else "N/A",
            "recommendations": recommendations_list
        }
    else:
        payload = {
            "id": str(scan.id),
            "date": scan.created_at.strftime("%d %b %Y") if scan.created_at else "N/A",
            "overallResult": result.tongue_shape or "Normal",
            "latestStatus": "Healthy" if (result and result.overall_wellness_score and result.overall_wellness_score >= 80) else "Coated Tip",
            "tongueColor": result.tongue_body_color or "N/A",
            "coating": result.tongue_coat_color or "N/A",
            "moisture": result.tongue_moisture or "N/A",
            "texture": result.tongue_shape or "N/A",
            "temperature": "N/A", # TODO: Field temperature not implemented in backend DB
            "analysis": f"Tongue coating is {result.tongue_coat_thick or 'normal'}.",
            "recommendations": recommendations_list
        }

    return success_response("Report fetched successfully", payload)
