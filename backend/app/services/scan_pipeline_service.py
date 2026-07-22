"""Sprint 3: real MediaPipe + OpenCV AI pipeline.

Entry point: run_scan_pipeline(scan_id, scan_type)
Creates its own DB session (BackgroundTask runs outside the request session).
"""
import concurrent.futures
import json
import logging
import types

import numpy as np

from app.db.session import SessionLocal
from app.repositories.face_scan_repository import FaceScanRepository
from app.repositories.scan_recommendation_repository import ScanRecommendationRepository
from app.repositories.scan_result_repository import ScanResultRepository

logger = logging.getLogger(__name__)

# Canonical metric order (matches the trained model's output heads).
_METRIC_KEYS = (
    "hydration_score",
    "oiliness_score",
    "wrinkle_score",
    "pigmentation_score",
    "dark_circle_score",
    "pore_score",
    "elasticity_score",
    "muscle_tone_score",
    "inflammation_score",
)

# Which ROI patches each metric depends on (for confidence estimation).
# muscle_tone depends on landmarks instead and is handled specially.
_METRIC_ROIS = {
    "hydration_score":    ("left_cheek", "right_cheek"),
    "oiliness_score":     ("t_zone",),
    "wrinkle_score":      ("forehead", "eye_corners_l"),
    "pigmentation_score": ("left_cheek", "right_cheek"),
    "dark_circle_score":  ("under_eye_l", "under_eye_r", "left_cheek", "right_cheek"),
    "pore_score":         ("left_cheek", "right_cheek"),
    "elasticity_score":   ("jawline", "forehead"),
    "inflammation_score": ("left_cheek", "right_cheek", "forehead"),
}


def _compute_confidence(metric_keys, rois, blur_score, lighting, landmarks, scoring_method):
    """Per-metric + overall analysis confidence in [0, 1].

    Combines a global image-quality factor (sharpness, lighting, scoring method)
    with how many of each metric's required ROIs were actually available. Lets the
    UI/report flag low-trust scores instead of presenting them as gospel.
    """
    import numpy as _np

    # Sharpness: blur_score < 30 is already rejected upstream; 120+ is crisp.
    sharp = float(_np.clip((blur_score - 30.0) / 90.0, 0.3, 1.0))
    light = {"good": 1.0, "poor": 0.65}.get(lighting, 0.8)
    method = 1.0 if scoring_method == "model" else 0.75
    global_factor = sharp * light * method

    rois = rois or {}
    out = {}
    for key in metric_keys:
        if key == "muscle_tone_score":
            roi_avail = 1.0 if landmarks else 0.4
        else:
            needed = _METRIC_ROIS.get(key, ())
            present = sum(1 for r in needed if rois.get(r) is not None)
            roi_avail = (present / len(needed)) if needed else 1.0
            roi_avail = 0.4 + 0.6 * roi_avail  # floor so a default score isn't 0-trust
        out[key] = round(global_factor * roi_avail, 2)

    out["overall"] = round(float(_np.mean(list(out.values()))) if out else 0.0, 2)
    return out


_MOCK_TONGUE_SCORES = {
    "tongue_body_color": "normal",
    "tongue_coat_color": "white",
    "tongue_coat_thick": "thin",
    "tongue_moisture": "moist",
    "tongue_shape": "normal",
    "overall_wellness_score": 72.0,
    "raw_metrics": {"mock": True, "sprint": 3},
}


def _load_image_bgr(scan) -> "np.ndarray":
    """Load the scan image as a BGR ndarray from remote storage or local filesystem."""
    import cv2

    if scan.image_url and scan.image_url.startswith("http"):
        import requests
        resp = requests.get(scan.image_url, timeout=30)
        resp.raise_for_status()
        arr = np.frombuffer(resp.content, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("cv2.imdecode returned None for remote image.")
        return img

    import os
    from app.core.config import settings
    abs_path = os.path.join(
        os.getcwd(),
        settings.LOCAL_UPLOADS_DIR,
        scan.image_public_id.replace("/", os.sep),
    )
    img = cv2.imread(abs_path)
    if img is None:
        raise FileNotFoundError(f"Could not read local image at {abs_path}")
    return img


def _rois_from_bbox(img: "np.ndarray", x: int, y: int, w: int, h: int) -> dict:
    """Create approximate facial ROIs from a face bounding box when landmarks are unavailable."""
    def crop(y1r, y2r, x1r=0.0, x2r=1.0):
        py1 = y + int(h * y1r)
        py2 = y + int(h * y2r)
        px1 = x + int(w * x1r)
        px2 = x + int(w * x2r)
        patch = img[py1:py2, px1:px2]
        return patch if patch.size > 0 else None

    return {
        "forehead":      crop(0.00, 0.25),
        "left_cheek":    crop(0.40, 0.72, 0.00, 0.42),
        "right_cheek":   crop(0.40, 0.72, 0.58, 1.00),
        "t_zone":        crop(0.15, 0.70, 0.35, 0.65),
        "under_eye_l":   crop(0.28, 0.42, 0.05, 0.42),
        "under_eye_r":   crop(0.28, 0.42, 0.58, 0.95),
        "jawline":       crop(0.72, 1.00),
        "eye_corners_l": crop(0.25, 0.42, 0.00, 0.35),
        "eye_corners_r": crop(0.25, 0.42, 0.65, 1.00),
        "temples_l":     crop(0.10, 0.35, 0.00, 0.20),
        "temples_r":     crop(0.10, 0.35, 0.80, 1.00),
    }


def _detect_face_opencv(img: "np.ndarray") -> "tuple[int,int,int,int] | None":
    """Fallback face detection using OpenCV Haar cascade. Returns (x,y,w,h) or None.

    Tries the frontal cascade with relaxed parameters on a histogram-equalised
    grayscale image (more robust to phone-selfie lighting), then the alt cascade.
    """
    import cv2

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    min_side = max(60, int(min(img.shape[:2]) * 0.18))

    for cascade_file in (
        "haarcascade_frontalface_default.xml",
        "haarcascade_frontalface_alt2.xml",
    ):
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + cascade_file)
        faces = cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=3, minSize=(min_side, min_side)
        )
        if len(faces) > 0:
            x, y, w, h = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)[0]
            return int(x), int(y), int(w), int(h)

    return None


def _center_bbox(img: "np.ndarray") -> "tuple[int,int,int,int]":
    """Approximate face box for when detection fails.

    The capture UI guides the user to centre their face inside an oval, so a
    centred crop is a reasonable ROI source — far better than hard-failing the
    whole scan when the Haar cascade misses (common without MediaPipe).
    """
    h, w = img.shape[:2]
    bw, bh = int(w * 0.62), int(h * 0.64)
    x = (w - bw) // 2
    y = int(h * 0.16)
    return x, y, bw, bh


def _serialize_landmarks(landmarks, img: "np.ndarray") -> str:
    """Serialize MediaPipe landmarks to compact normalized [[x,y],...] JSON.

    Consumed by the mobile FaceMeshOverlay to draw the mesh over the still.
    """
    pts = [[round(float(lm.x), 4), round(float(lm.y), 4)] for lm in landmarks]
    return json.dumps({"type": "mesh", "points": pts})


def _serialize_bbox(img: "np.ndarray", x: int, y: int, w: int, h: int) -> str:
    """Serialize a fallback face bounding box (normalized) for the client overlay."""
    H, W = img.shape[:2]
    return json.dumps({
        "type": "bbox",
        "rect": [round(x / W, 4), round(y / H, 4), round(w / W, 4), round(h / H, 4)],
    })


def _run_face_pipeline(db, scan, img: "np.ndarray") -> dict:
    """Execute the full face analysis pipeline and return a scores dict."""
    import cv2

    from app.ai.analyzers import (
        hydration_analyzer,
        oiliness_analyzer,
        wrinkle_analyzer,
        pigmentation_analyzer,
        dark_circle_analyzer,
        pore_analyzer,
        elasticity_analyzer,
        muscle_tone_analyzer,
        inflammation_analyzer,
        glow_score_engine,
        toxin_indicator,
    )
    from app.ai.image_preprocessor import normalize_white_balance, estimate_skin_tone

    # Colour-constancy: neutralise the lighting cast once so every colour-based
    # analyzer (redness, pigmentation, dark circles) sees comparable colours.
    # Detection still runs on the original image; only analysis ROIs use WB.
    img_wb = normalize_white_balance(img)

    # Try full MediaPipe landmark pipeline first; fall back to OpenCV Haar cascade
    landmarks = []
    confidence = 0.0
    rois = None
    using_fallback = False

    FaceScanRepository.set_progress(db, scan, "detecting")

    try:
        from app.ai.face_detector import get_face_detector
        from app.ai.image_preprocessor import extract_rois
        landmarks, confidence = get_face_detector().detect(img)
        scan.face_detected = len(landmarks) > 0
        scan.face_confidence = float(confidence)

        if landmarks:
            scan.landmarks_json = _serialize_landmarks(landmarks, img)
            db.commit()
            rois = extract_rois(img_wb, landmarks)
        else:
            db.commit()
    except RuntimeError:
        # MediaPipe not installed — fall back to OpenCV Haar cascade
        logger.info("MediaPipe unavailable; falling back to OpenCV face detection for scan %d", scan.id)
        using_fallback = True
        bbox = _detect_face_opencv(img)
        if bbox is not None:
            scan.face_detected = True
            scan.face_confidence = 0.85
        else:
            # Detection missed — analyse the centred region rather than failing.
            # The capture UI guides the user to centre their face in the oval.
            logger.info("Haar cascade missed; using centred crop for scan %d", scan.id)
            bbox = _center_bbox(img)
            scan.face_detected = False
            scan.face_confidence = 0.0
        x, y, w, h = bbox
        scan.landmarks_json = _serialize_bbox(img, x, y, w, h)
        db.commit()
        rois = _rois_from_bbox(img_wb, x, y, w, h)
        landmarks = []

    # MediaPipe loaded but found no landmarks — degrade to a bbox crop too.
    if rois is None:
        using_fallback = True
        bbox = _detect_face_opencv(img) or _center_bbox(img)
        x, y, w, h = bbox
        scan.landmarks_json = _serialize_bbox(img, x, y, w, h)
        db.commit()
        rois = _rois_from_bbox(img_wb, x, y, w, h)
        landmarks = []

    FaceScanRepository.set_progress(db, scan, "analyzing")

    # Tone-aware baselines (fairness across complexions) from the WB ROIs.
    skin_tone = estimate_skin_tone(rois)

    # ── Trained model first, recalibrated CV as the fallback ──────────────────
    # The ONNX skin model (when present) is the validated scorer; CV is the
    # graceful fallback until a model is trained and dropped in.
    scoring_method = "cv"
    model_scores = None
    try:
        from app.ai.skin_model import get_skin_model
        model = get_skin_model()
        if model is not None:
            model_scores = model.predict(img_wb, rois=rois, landmarks=landmarks)
    except Exception as exc:  # never let model issues fail the scan
        logger.warning("Skin model inference unavailable (%s); using CV", exc)

    if model_scores:
        partial_scores = {k: round(float(v), 2) for k, v in model_scores.items()}
        # muscle_tone has no labeled dataset, so the model doesn't predict it —
        # keep the landmark-based CV analyzer for that head.
        if "muscle_tone_score" not in partial_scores:
            try:
                partial_scores["muscle_tone_score"] = (
                    round(muscle_tone_analyzer.analyze(landmarks, img.shape[0], img.shape[1]), 2)
                    if landmarks else 60.0
                )
            except Exception:
                partial_scores["muscle_tone_score"] = 60.0
        scoring_method = "model"
    else:
        # Run CV analyzers in parallel (up to 4 workers)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            fut_hydration    = executor.submit(hydration_analyzer.analyze,    rois["left_cheek"],  rois["right_cheek"])
            fut_oiliness     = executor.submit(oiliness_analyzer.analyze,     rois["t_zone"])
            fut_wrinkle      = executor.submit(wrinkle_analyzer.analyze,      rois["forehead"],    rois["eye_corners_l"])
            fut_pigmentation = executor.submit(pigmentation_analyzer.analyze,  img_wb,              rois["left_cheek"],  rois["right_cheek"])
            fut_dark_circle  = executor.submit(dark_circle_analyzer.analyze,   rois["under_eye_l"], rois["under_eye_r"], rois["left_cheek"], rois["right_cheek"])
            fut_pore         = executor.submit(pore_analyzer.analyze,          rois["left_cheek"],  rois["right_cheek"])
            fut_elasticity   = executor.submit(elasticity_analyzer.analyze,    rois["jawline"],     rois["forehead"])
            # muscle_tone requires landmarks; use 60 (neutral) when using fallback
            fut_muscle_tone  = (
                executor.submit(muscle_tone_analyzer.analyze, landmarks, img.shape[0], img.shape[1])
                if landmarks else None
            )
            fut_inflammation = executor.submit(
                inflammation_analyzer.analyze,
                rois["left_cheek"], rois["right_cheek"], rois["forehead"],
                skin_tone["baseline_a"],
            )

            partial_scores = {
                "hydration_score":    round(fut_hydration.result(),    2),
                "oiliness_score":     round(fut_oiliness.result(),     2),
                "wrinkle_score":      round(fut_wrinkle.result(),      2),
                "pigmentation_score": round(fut_pigmentation.result(), 2),
                "dark_circle_score":  round(fut_dark_circle.result(),  2),
                "pore_score":         round(fut_pore.result(),         2),
                "elasticity_score":   round(fut_elasticity.result(),   2),
                "muscle_tone_score":  round(fut_muscle_tone.result(), 2) if fut_muscle_tone else 60.0,
                "inflammation_score": round(fut_inflammation.result(), 2),
            }

    computed_glow = glow_score_engine.compute(partial_scores)
    computed_toxin = toxin_indicator.compute(
        partial_scores["dark_circle_score"], partial_scores["oiliness_score"], computed_glow
    )

    # Gentler slope + tighter clamp so a single saturating metric can't push a
    # young, clear face into the 50s. Anchored at 28 with modest wrinkle/elasticity
    # influence; capped at 58 (a heuristic estimate, not a medical claim).
    skin_age = int(np.clip(
        28 + (partial_scores["wrinkle_score"] - 45) * 0.18 - (partial_scores["elasticity_score"] - 55) * 0.14,
        18, 58,
    ))

    overall_wellness_score = round(computed_glow * 0.7 + (100.0 - computed_toxin) * 0.3, 2)

    blur_score = float(getattr(scan, "blur_score", 0.0) or 0.0)
    lighting   = str(getattr(scan, "lighting_quality", "unknown") or "unknown")

    # Per-metric + overall confidence so the UI/report can flag low-trust scores.
    confidence = _compute_confidence(
        partial_scores.keys(), rois, blur_score, lighting,
        landmarks=landmarks, scoring_method=scoring_method,
    )

    raw_metrics = {
        "sprint":          3,
        "scoring_method":  scoring_method,
        "blur_score":      blur_score,
        "lighting":        lighting,
        "landmark_count":  len(landmarks),
        "cv_fallback":     using_fallback,
        "skin_tone":       skin_tone,
        "confidence":      confidence,
    }

    return {
        **partial_scores,
        "glow_score":             computed_glow,
        "toxin_indicator":        computed_toxin,
        "overall_wellness_score": overall_wellness_score,
        "skin_age_estimate":      skin_age,
        "raw_metrics":            raw_metrics,
    }


def run_scan_pipeline(scan_id: int, scan_type: str) -> None:
    """BackgroundTask entry point — creates its own DB session per spec §11.1."""
    import cv2

    from app.ai.image_preprocessor import detect_blur, detect_lighting, resize_for_analysis
    from app.services import recommendation_engine_service
    from app.services.upload_service import UploadService

    db = SessionLocal()
    try:
        # 1-2. Load scan record
        scan = FaceScanRepository.get_by_id(db, scan_id)
        if not scan:
            logger.error("Scan %d not found in background task", scan_id)
            return

        # 3. Mark processing
        FaceScanRepository.set_status(db, scan, "processing")
        FaceScanRepository.set_progress(db, scan, "preprocessing")

        # 4. Load image as BGR ndarray
        img_bgr = _load_image_bgr(scan)

        # 5. Resize
        img = resize_for_analysis(img_bgr)

        # 6. Store dimensions
        scan.image_width  = img.shape[1]
        scan.image_height = img.shape[0]
        db.commit()

        # 7. Blur check
        blur_score = detect_blur(img)
        scan.blur_score = float(blur_score)
        db.commit()

        # Only reject genuinely unusable (severely out-of-focus) images. Phone
        # selfies routinely score well under the old 100 threshold, which caused
        # most scans to fail; 30 still catches motion-blurred / black frames.
        if blur_score < 30:
            FaceScanRepository.set_status(
                db,
                scan,
                "failed",
                error_message="Image is too blurry. Hold still and retake in good lighting.",
            )
            return

        # 8. Lighting check
        lighting = detect_lighting(img)
        scan.lighting_quality = lighting
        db.commit()

        # 8b. Enhancement stage. Produce a cleaned-up preview for the user (display
        # only — analyzers use their own white-balanced image, see _run_face_pipeline)
        # and persist it so the results screen can show the enhanced photo.
        FaceScanRepository.set_progress(db, scan, "enhancing")
        if scan_type == "face":
            try:
                from app.ai.enhance import enhance_for_display
                processed = enhance_for_display(img)
                ok, buf = cv2.imencode(".jpg", processed, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
                if ok:
                    stored = UploadService.store_processed(buf.tobytes(), user_id=scan.user_id)
                    scan.processed_image_url = stored["url"]
                    scan.processed_image_public_id = stored["public_id"]
                    db.commit()
            except Exception as exc:  # never fail the scan over a display preview
                logger.warning("Enhanced preview generation failed for scan %d: %s", scan_id, exc)

        # 9 / 10. Branch on scan type
        if scan_type == "face":
            scores = _run_face_pipeline(db, scan, img)
            if not scores:
                # set_status already called inside _run_face_pipeline
                return
        else:
            # Tongue scan — real GrabCut + Lab classification pipeline (Sprint 4).
            try:
                from app.ai.tongue import analyze as analyze_tongue
                scores = analyze_tongue(img)
            except Exception as exc:
                logger.warning("Tongue pipeline failed (%s); using neutral defaults", exc)
                scores = dict(_MOCK_TONGUE_SCORES)

            # Reject frames where no tongue is actually visible instead of
            # returning bogus TCM markers (mirrors the no-face failure path).
            if scores.get("tongue_detected") is False:
                FaceScanRepository.set_status(
                    db,
                    scan,
                    "failed",
                    error_message="No tongue detected. Stick out your tongue to fill the outline and retake.",
                )
                return

            # Serialize the detected tongue bbox so the mobile processing screen
            # can crop+zoom to it and outline the tongue (parallels the face mesh).
            tongue_bbox = (scores.get("raw_metrics") or {}).get("tongue_bbox")
            if tongue_bbox:
                scan.landmarks_json = json.dumps({"type": "bbox", "rect": tongue_bbox})
                db.commit()

        # 11. Persist scan result
        FaceScanRepository.set_progress(db, scan, "scoring")
        result_orm = ScanResultRepository.create(db, scan_id=scan_id, scores=scores)

        # 12. Generate recommendations via SimpleNamespace for attribute access
        result_ns = types.SimpleNamespace(**scores)
        recommendations = recommendation_engine_service.generate(result_ns)

        # 13. Persist recommendations
        ScanRecommendationRepository.bulk_create(db, scan_id=scan_id, items=recommendations)

        # 14. Mark completed
        FaceScanRepository.set_progress(db, scan, "done")
        FaceScanRepository.set_status(db, scan, "completed")
        logger.info(
            "Scan %d (%s) completed — glow=%.2f, sprint=3",
            scan_id,
            scan_type,
            float(scores.get("glow_score", scores.get("overall_wellness_score", 0.0))),
        )

    except Exception as exc:
        # Structured context for later investigation; full traceback included.
        stage = None
        try:
            stage = scan.progress_stage if scan else None
        except Exception:
            stage = None
        logger.exception(
            "Scan pipeline failed for scan_id=%s type=%s stage=%s: %s",
            scan_id, scan_type, stage, exc,
        )
        try:
            db.rollback()
            scan = FaceScanRepository.get_by_id(db, scan_id)
            if scan:
                # Friendly, actionable message for the user; the full traceback is
                # in the logs above for debugging.
                FaceScanRepository.set_status(
                    db,
                    scan,
                    "failed",
                    error_message="We couldn't analyse this photo. Please retake with your face centred in good lighting.",
                )
        except Exception as inner_exc:
            logger.error("Failed to mark scan %d as failed: %s", scan_id, inner_exc)
    finally:
        db.close()
