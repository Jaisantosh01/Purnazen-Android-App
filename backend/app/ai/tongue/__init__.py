"""Tongue analysis pipeline — YOLO localizer + TCM colour heuristics.

Mirrors the face pipeline: a real detector (TongueDiagnosis YOLOv5, same role as
MediaPipe FaceLandmarker) finds the tongue; classical Lab/HSV rules then score
body colour, coat, moisture and shape. Extra TCM heads (greasiness, cracks,
tooth marks) stay "coming soon" until their classification weights are wired.

Entry point: ``analyze(img_bgr) -> dict`` for ``scan_pipeline_service``.
"""
from __future__ import annotations

import logging

import numpy as np

from app.ai.tongue.color_analyzer import analyze_colors
from app.ai.tongue.segmenter import (
    find_best_tongue_blob,
    segment_tongue,
    tongue_body_coverage,
    tongue_body_coverage_full,
    tongue_chroma,
    tongue_coverage,
)
from app.ai.tongue.tcm_rules import overall_wellness

logger = logging.getLogger(__name__)

# Guide-oval heuristics (live camera). Gallery / YOLO paths use blob + model.
MIN_TONGUE_COVERAGE = 0.10
MIN_TONGUE_COVERAGE_WITH_FACE = 0.18
# Lab a*: empty/beige scenes sit near neutral; tongues are distinctly redder.
MIN_TONGUE_CHROMA_A = 140.0
MIN_BLOB_COVERAGE = 0.04
MIN_BLOB_CHROMA_A = 140.0
# Almost no pink/red body tissue anywhere → empty room / wall / no subject.
MIN_BODY_FULL_FRAME = 0.012
MIN_YOLO_CONF = 0.45
MIN_YOLO_CONF_EMPTY = 0.60


def is_tongue_present(img_bgr: np.ndarray, *, face_count: int = 0) -> bool:
    """True when a tongue is likely in frame (model or classical CV).

    Empty rooms / walls must stay amber: presence requires pink/red *body*
    tissue (not the pale "coat" band that beige walls match), plus either a
    confident YOLO hit or enough fill in the guide oval / a strong body blob.
    """
    body_guide = tongue_body_coverage(img_bgr)
    body_full = tongue_body_coverage_full(img_bgr)

    yolo_hit = None
    try:
        from app.ai.tongue_detector import detect_tongue

        yolo_hit = detect_tongue(img_bgr)
    except Exception as exc:
        logger.debug("Tongue YOLO check skipped (%s)", exc)

    # Hard reject: no pink/red tissue in the frame at all (empty room, desk, wall).
    if body_full < MIN_BODY_FULL_FRAME and body_guide < 0.02:
        if not (yolo_hit and yolo_hit.get("confidence", 0) >= MIN_YOLO_CONF_EMPTY):
            return False

    if yolo_hit and yolo_hit.get("confidence", 0) >= MIN_YOLO_CONF:
        # YOLO alone on an empty beige wall is a known false positive — require
        # a little body colour corroboration unless confidence is very high.
        if body_full >= MIN_BODY_FULL_FRAME or body_guide >= 0.02:
            return True
        if yolo_hit["confidence"] >= MIN_YOLO_CONF_EMPTY:
            return True
        return False

    blob = find_best_tongue_blob(img_bgr)
    if blob is not None:
        if face_count >= 1:
            if blob["coverage"] >= 0.10 and blob["chroma"] >= 142:
                return True
        elif blob["coverage"] >= MIN_BLOB_COVERAGE and blob["chroma"] >= MIN_BLOB_CHROMA_A:
            return True

    # Live oval path — body fill + redness inside the guide.
    if body_guide < MIN_TONGUE_COVERAGE:
        return False
    if tongue_chroma(img_bgr) < MIN_TONGUE_CHROMA_A:
        return False
    if face_count >= 1 and body_guide < MIN_TONGUE_COVERAGE_WITH_FACE:
        return False
    return True


def _mask_bbox(mask: np.ndarray) -> list | None:
    """Normalized [x, y, w, h] bounding box of the segmented tongue, or None."""
    ys, xs = np.where(mask > 0)
    if xs.size == 0:
        return None
    h, w = mask.shape[:2]
    x1, x2 = int(xs.min()), int(xs.max())
    y1, y2 = int(ys.min()), int(ys.max())
    return [
        round(x1 / w, 4),
        round(y1 / h, 4),
        round((x2 - x1) / w, 4),
        round((y2 - y1) / h, 4),
    ]


def analyze(img_bgr: np.ndarray) -> dict:
    """Run the tongue pipeline. Always returns a valid scores dict."""
    yolo_hit = None
    try:
        from app.ai.tongue_detector import detect_tongue

        yolo_hit = detect_tongue(img_bgr)
    except Exception:
        yolo_hit = None

    seed = yolo_hit["bbox"] if yolo_hit else None
    coverage = tongue_coverage(img_bgr)
    chroma = tongue_chroma(img_bgr)
    tongue_detected = is_tongue_present(img_bgr)

    mask, used_fallback = segment_tongue(img_bgr, seed_bbox=seed)
    markers = analyze_colors(img_bgr, mask)
    score = overall_wellness(markers)
    bbox = _mask_bbox(mask)
    if bbox is None and yolo_hit is not None:
        h, w = img_bgr.shape[:2]
        x, y, bw, bh = yolo_hit["bbox"]
        bbox = [round(x / w, 4), round(y / h, 4), round(bw / w, 4), round(bh / h, 4)]

    # YOLO hit always counts; otherwise keep the colour/blob gate.
    if yolo_hit and yolo_hit.get("confidence", 0) >= MIN_YOLO_CONF:
        tongue_detected = True

    return {
        "tongue_body_color": markers["body_color"],
        "tongue_coat_color": markers["coat_color"],
        "tongue_coat_thick": markers["coat_thick"],
        "tongue_moisture":   markers["moisture"],
        "tongue_shape":      markers["shape"],
        "overall_wellness_score": score,
        "tongue_detected": tongue_detected,
        # Placeholder heads — UI can label these Coming soon.
        "tongue_greasiness": None,
        "tongue_cracks": None,
        "tongue_tooth_marks": None,
        "raw_metrics": {
            "sprint": 4,
            "scoring_method": "yolo+cv" if yolo_hit else "cv",
            "tongue_segmentation_fallback": used_fallback,
            "tongue_coverage": round(coverage, 4),
            "tongue_chroma_a": round(chroma, 2),
            "tongue_detected": tongue_detected,
            "tongue_bbox": bbox,
            "yolo_confidence": round(yolo_hit["confidence"], 3) if yolo_hit else None,
            "tongue_metrics": markers["raw"],
            "coming_soon": ["greasiness", "cracks", "tooth_marks"],
        },
    }
