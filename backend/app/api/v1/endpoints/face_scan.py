import json
import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.repositories.face_scan_repository import FaceScanRepository
from app.repositories.scan_recommendation_repository import ScanRecommendationRepository
from app.repositories.scan_result_repository import ScanResultRepository
from app.services.consent_service import ConsentService
from app.services.scan_dashboard_service import ScanDashboardService
from app.services.scan_pipeline_service import run_scan_pipeline
from app.services.upload_service import UploadService
from app.utils.responses import error_response, success_response

router = APIRouter(prefix="/face-glow", tags=["Face Scan"])


def _quality_gate(content: bytes, scan_type: str = "face"):
    """Run the capture-quality assessment on raw image bytes.

    Returns a 422 ``error_response`` (with reason + guidance) if the photo has a
    blocking quality issue, or ``None`` to proceed. Degrades to None (no gate) if
    the CV stack isn't installed, so uploads still work without the AI deps.
    """
    try:
        import cv2
        import numpy as np

        from app.ai.image_preprocessor import resize_for_analysis
        from app.ai.quality import assess_quality, first_blocking_issue
    except ImportError:
        logger.warning("CV stack not available; quality gate bypassed for scan_type=%s", scan_type)
        return None

    img = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return None

    assessment = assess_quality(resize_for_analysis(img), scan_type=scan_type)
    blocking = first_blocking_issue(assessment)
    if blocking:
        return error_response(
            blocking["guidance"],
            status_code=422,
            reason=blocking["code"],
            guidance=blocking["guidance"],
            extra={"quality": assessment["metrics"]},
        )
    return None


@router.post(
    "/scan/upload",
    summary="Upload face or tongue scan image",
    description=(
        "Accepts a multipart JPEG/PNG upload, validates scan_storage consent, "
        "stores the image on Azure Blob Storage, enqueues the AI pipeline, and returns 202."
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

    content = await file.read()

    # Capture-quality gate — fast, synchronous, before we store or enqueue anything.
    # Returns specific retake guidance so the user can fix it.
    gate = _quality_gate(content, scan_type=scan_type)
    if gate is not None:
        return gate

    upload = await UploadService.validate_and_upload_bytes(content, user_id=user.id, folder_suffix="raw")

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
    scan_id: uuid.UUID,
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
        "image_url": scan.image_url,
        "processed_image_url": scan.processed_image_url,
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
    description="Hard-deletes the scan record and both stored images.",
)
def delete_scan(
    scan_id: uuid.UUID,
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


@router.get("/dashboard", summary="Skin / tongue dashboard (latest + rolling avg + trend)")
def get_dashboard(
    scan_type: str = Query("face", pattern="^(face|tongue)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return success_response("Dashboard fetched", ScanDashboardService.dashboard(db, user.id, scan_type))


@router.get("/trends", summary="Time series for a single metric")
def get_trends(
    metric: str = Query("glow_score"),
    days: int = Query(0, ge=0, le=365),
    scan_type: str = Query("face", pattern="^(face|tongue)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = ScanDashboardService.trends(db, user.id, metric, days or None, scan_type)
    if data.get("error"):
        return error_response(data["error"], status_code=400)
    return success_response("Trends fetched", data)


class _CompareBody(BaseModel):
    compare_to_id: int | None = None


@router.post(
    "/quality-preview",
    summary="Live camera quality check (no scan created)",
    description=(
        "Accepts a JPEG/PNG snapshot and returns a quality assessment without "
        "persisting anything. Used by the mobile camera view for live feedback."
    ),
)
async def quality_preview(
    file: UploadFile = File(...),
    scan_type: str = Query("face", pattern="^(face|tongue)$"),
    user: User = Depends(get_current_user),
):
    content = await file.read()
    try:
        import cv2
        import numpy as np

        from app.ai.image_preprocessor import resize_for_analysis
        from app.ai.quality import assess_quality
    except ImportError:
        return success_response("Quality check unavailable", {"ok": True, "issues": []})

    img = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return error_response("Could not decode image", status_code=422)

    assessment = assess_quality(resize_for_analysis(img), scan_type=scan_type)
    return success_response("Quality assessed", assessment)


@router.post("/scan/{scan_id}/compare", summary="Compare a scan to a baseline scan")
def compare_scan(
    scan_id: uuid.UUID,
    body: _CompareBody = _CompareBody(),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = ScanDashboardService.compare(db, user.id, scan_id, body.compare_to_id)
    if data is None:
        return error_response("Scan not found", status_code=404)
    return success_response("Comparison ready", data)
