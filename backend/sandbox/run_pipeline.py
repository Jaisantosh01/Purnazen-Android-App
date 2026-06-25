"""
Sandbox: run the full face analysis pipeline on a local image file.

Usage:
    python sandbox/run_pipeline.py path/to/face.jpg
    python sandbox/run_pipeline.py  # uses a generated synthetic image

Run from the backend/ directory so imports resolve correctly:
    cd backend
    python sandbox/run_pipeline.py
"""
import sys
import os
import time
import json
import logging

# Add backend root to path so app.* imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("sandbox.run_pipeline")


def make_synthetic_face(width=480, height=640):
    """Generate a synthetic skin-tone image for smoke testing without a real photo."""
    import cv2
    import numpy as np

    img = np.zeros((height, width, 3), dtype=np.uint8)
    # Flesh-tone background (BGR)
    img[:] = (100, 140, 190)
    # Draw a crude oval "face"
    cx, cy = width // 2, int(height * 0.42)
    cv2.ellipse(img, (cx, cy), (int(width * 0.32), int(height * 0.38)), 0, 0, 360, (110, 155, 210), -1)
    # Add some texture noise
    noise = np.random.randint(0, 20, (height, width, 3), dtype=np.uint8)
    img = cv2.add(img, noise)
    return img


def run(image_path=None):
    import cv2
    import numpy as np
    from app.ai.image_preprocessor import resize_for_analysis, detect_blur, detect_lighting
    from app.ai.analyzers import (
        hydration_analyzer, oiliness_analyzer, wrinkle_analyzer,
        pigmentation_analyzer, dark_circle_analyzer, pore_analyzer,
        elasticity_analyzer, muscle_tone_analyzer, inflammation_analyzer,
        glow_score_engine, toxin_indicator,
    )
    from app.services.scan_pipeline_service import _detect_face_opencv, _rois_from_bbox

    # ── 1. Load image ──────────────────────────────────────────────────────────
    if image_path:
        img = cv2.imread(image_path)
        if img is None:
            raise FileNotFoundError(f"Cannot read image: {image_path}")
        logger.info("Loaded image from %s  shape=%s", image_path, img.shape)
    else:
        img = make_synthetic_face()
        logger.info("Using synthetic face image  shape=%s", img.shape)

    t0 = time.perf_counter()

    # ── 2. Pre-process ─────────────────────────────────────────────────────────
    img = resize_for_analysis(img)
    blur = detect_blur(img)
    lighting = detect_lighting(img)
    logger.info("blur_score=%.1f  lighting=%s", blur, lighting)

    if blur < 100:
        logger.warning("Image is blurry (score=%.1f < 100). Results may be inaccurate.", blur)

    # ── 3. Face detection ──────────────────────────────────────────────────────
    # Try MediaPipe first; fall back to OpenCV Haar cascade
    landmarks = []
    rois = None
    using_fallback = False

    try:
        from app.ai.face_detector import get_face_detector
        from app.ai.image_preprocessor import extract_rois
        logger.info("Attempting MediaPipe face detection…")
        landmarks, conf = get_face_detector().detect(img)
        logger.info("MediaPipe: %d landmarks, confidence=%.2f", len(landmarks), conf)
        if landmarks:
            rois = extract_rois(img, landmarks)
    except RuntimeError as e:
        logger.warning("MediaPipe unavailable (%s). Using OpenCV Haar cascade.", e)
        using_fallback = True

    if rois is None:
        bbox = _detect_face_opencv(img)
        if bbox is None:
            if image_path:
                logger.error("No face detected — cannot continue.")
                return None
            # Synthetic image: use a manual bbox covering the drawn ellipse area
            H, W = img.shape[:2]
            x, y, w, h = int(W * 0.18), int(H * 0.04), int(W * 0.64), int(H * 0.76)
            logger.warning("Synthetic image: using manual bbox (%d,%d) %dx%d", x, y, w, h)
            using_fallback = True
        else:
            x, y, w, h = bbox
            logger.info("OpenCV Haar: face at (%d,%d) size %dx%d", x, y, w, h)
        rois = _rois_from_bbox(img, x, y, w, h)

    # ── 4. Run analyzers ───────────────────────────────────────────────────────
    def safe(fn, *args, default=50.0):
        try:
            return round(float(fn(*args)), 2)
        except Exception as exc:
            logger.warning("Analyzer %s failed: %s", fn.__module__, exc)
            return default

    import numpy as np
    scores = {
        "hydration":    safe(hydration_analyzer.analyze,    rois["left_cheek"],  rois["right_cheek"]),
        "oiliness":     safe(oiliness_analyzer.analyze,     rois["t_zone"]),
        "wrinkle":      safe(wrinkle_analyzer.analyze,      rois["forehead"],    rois["eye_corners_l"]),
        "pigmentation": safe(pigmentation_analyzer.analyze,  img, rois["left_cheek"], rois["right_cheek"]),
        "dark_circle":  safe(dark_circle_analyzer.analyze,   rois["under_eye_l"], rois["under_eye_r"], rois["left_cheek"], rois["right_cheek"]),
        "pore":         safe(pore_analyzer.analyze,          rois["left_cheek"],  rois["right_cheek"]),
        "elasticity":   safe(elasticity_analyzer.analyze,    rois["jawline"],     rois["forehead"]),
        "muscle_tone":  safe(muscle_tone_analyzer.analyze,   landmarks, img.shape[0], img.shape[1]) if landmarks else 60.0,
        "inflammation": safe(inflammation_analyzer.analyze,  rois["left_cheek"],  rois["right_cheek"], rois["forehead"]),
    }

    # ── 5. Composite scores ────────────────────────────────────────────────────
    glow = glow_score_engine.compute({
        "hydration_score": scores["hydration"],
        "oiliness_score": scores["oiliness"],
        "wrinkle_score": scores["wrinkle"],
        "pigmentation_score": scores["pigmentation"],
        "dark_circle_score": scores["dark_circle"],
        "pore_score": scores["pore"],
        "elasticity_score": scores["elasticity"],
        "muscle_tone_score": scores["muscle_tone"],
        "inflammation_score": scores["inflammation"],
    })
    toxin = toxin_indicator.compute(scores["dark_circle"], scores["oiliness"], glow)
    wellness = round(glow * 0.7 + (100.0 - toxin) * 0.3, 2)
    skin_age = int(np.clip(30 + (scores["wrinkle"] - 40) * 0.3 - (scores["elasticity"] - 60) * 0.2, 18, 70))

    elapsed = time.perf_counter() - t0

    result = {
        "glow_score": round(glow, 2),
        "toxin_indicator": round(toxin, 2),
        "overall_wellness_score": wellness,
        "skin_age_estimate": skin_age,
        "blur_score": round(blur, 1),
        "lighting": lighting,
        "landmark_count": len(landmarks),
        "cv_fallback": using_fallback,
        "elapsed_s": round(elapsed, 3),
        **{f"{k}_score": v for k, v in scores.items()},
    }

    print("\n" + "=" * 52)
    print("  PIPELINE RESULTS")
    print("=" * 52)
    for k, v in result.items():
        print(f"  {k:<28} {v}")
    print("=" * 52)
    print(f"  Completed in {elapsed:.3f}s")
    return result


if __name__ == "__main__":
    img_path = sys.argv[1] if len(sys.argv) > 1 else None
    run(img_path)
