import json

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.repositories.face_scan_repository import FaceScanRepository
from app.repositories.scan_recommendation_repository import ScanRecommendationRepository
from app.repositories.scan_result_repository import ScanResultRepository
from app.services.consent_service import ConsentService
from app.services.scan_pipeline_service import run_scan_pipeline
from app.services.upload_service import UploadService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/face-glow", tags=["Face Scan"])


@router.post(
    "/scan/upload",
    summary="Upload face or tongue scan image",
    description=(
        "Accepts a multipart JPEG/PNG upload, validates scan_storage consent, "
        "stores the image on Cloudinary, enqueues the AI pipeline, and returns 202."
    ),
    status_code=202,
)
async def upload_scan(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    scan_type: str = Query("face", pattern="^(face|tongue)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not ConsentService.has_consent(db, user.id, "scan_storage"):
        return error_response("Scan storage consent required", status_code=403)

    upload = await UploadService.validate_and_upload(file, user_id=user.id, folder_suffix="raw")

    scan = FaceScanRepository.create(
        db,
        user_id=user.id,
        scan_type=scan_type,
        image_url=upload["url"],
        image_public_id=upload["public_id"],
        file_size_bytes=upload["bytes"],
    )

    background_tasks.add_task(run_scan_pipeline, scan.id, scan_type)

    return success_response(
        "Scan queued successfully",
        {"scan_id": scan.id, "status": "queued", "estimated_seconds": 10},
        status_code=202,
    )


@router.get(
    "/scan/{scan_id}/status",
    summary="Poll scan status and results",
    description="Returns current status. When completed, includes scores and recommendations.",
)
def get_scan_status(
    scan_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan = FaceScanRepository.get_by_id(db, scan_id)
    if not scan or scan.user_id != user.id:
        return error_response("Scan not found", status_code=404)

    landmarks = None
    if scan.landmarks_json:
        try:
            landmarks = json.loads(scan.landmarks_json)
        except (ValueError, TypeError):
            landmarks = None

    payload = {
        "scan_id": scan.id,
        "status": scan.status,
        "scan_type": scan.scan_type,
        "progress_stage": scan.progress_stage,
        "error_message": scan.error_message,
        "image_width": scan.image_width,
        "image_height": scan.image_height,
        "landmarks": landmarks,
        "created_at": scan.created_at.isoformat() if scan.created_at else None,
        "processing_completed_at": (
            scan.processing_completed_at.isoformat() if scan.processing_completed_at else None
        ),
        "results": None,
        "recommendations": [],
    }

    if scan.status == "completed":
        result = ScanResultRepository.get_by_scan_id(db, scan_id)
        recs = ScanRecommendationRepository.get_by_scan_id(db, scan_id)
        payload["results"] = result.to_dict() if result else None
        payload["recommendations"] = [r.to_dict() for r in recs]

    return success_response("Scan status fetched", payload)


@router.get(
    "/history",
    summary="Paginated scan history",
    description="Returns scans for the current user, optionally filtered by scan_type.",
)
def get_scan_history(
    scan_type: str = Query("all", pattern="^(face|tongue|all)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scans, total = FaceScanRepository.get_by_user(db, user.id, scan_type=scan_type, page=page, limit=limit)

    items = []
    for scan in scans:
        result = ScanResultRepository.get_by_scan_id(db, scan.id)
        items.append({
            "id": scan.id,
            "scanType": scan.scan_type,
            "status": scan.status,
            "glowScore": float(result.glow_score) if result and result.glow_score is not None else None,
            "overallWellnessScore": float(result.overall_wellness_score) if result and result.overall_wellness_score is not None else None,
            "imageUrl": scan.image_url,
            "createdAt": scan.created_at.isoformat() if scan.created_at else None,
        })

    return success_response(
        "Scan history fetched",
        {"scans": items, "total": total, "page": page, "limit": limit},
    )


@router.delete(
    "/scan/{scan_id}",
    summary="Delete a scan (GDPR)",
    description="Hard-deletes the scan record and both Cloudinary images.",
)
def delete_scan(
    scan_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scan = FaceScanRepository.get_by_id(db, scan_id)
    if not scan or scan.user_id != user.id:
        return error_response("Scan not found", status_code=404)

    UploadService.delete_image(scan.image_public_id or "")
    UploadService.delete_image(scan.processed_image_public_id or "")
    FaceScanRepository.delete(db, scan)

    return success_response("Scan deleted successfully")
