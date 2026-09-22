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


_UNSET = object()


def is_tongue_present(img_bgr: np.ndarray, *, face_count: int = 0, yolo_hit=_UNSET) -> bool:
    """True when a tongue is likely in frame (model or classical CV).

    Empty rooms / walls must stay amber: presence requires pink/red *body*
    tissue (not the pale "coat" band that beige walls match), plus either a
    confident YOLO hit or enough fill in the guide oval / a strong body blob.

    ``yolo_hit`` lets a caller that already ran the detector pass its result in
    (``None`` = ran, nothing found) so YOLO isn't invoked a second time.
    """
    body_guide = tongue_body_coverage(img_bgr)
    body_full = tongue_body_coverage_full(img_bgr)

    if yolo_hit is _UNSET:
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


# Model confidence above which a TCM finding overrides the threshold category.
TCM_OVERRIDE_CONF = 0.50
# …and above which one of the three app heads reads "present".
TCM_HEAD_CONF = 0.35

_TCM_BODY = {"red_body": "red", "purple_body": "purple"}
_TCM_COAT = {"white_coat": "white", "yellow_coat": "yellow"}
_TCM_SHAPE = {"swollen_body": "swollen", "thin_body": "thin"}


def _best(findings: dict, table: dict) -> str | None:
    hits = [(findings.get(k, 0.0), v) for k, v in table.items()]
    conf, value = max(hits) if hits else (0.0, None)
    return value if conf >= TCM_OVERRIDE_CONF else None


def apply_tcm_findings(markers: dict, findings: dict) -> dict:
    """Let confident model findings override the Lab/HSV categories.

    Only the categories the recommendation engine already understands are
    touched; everything else stays as the classical analyzer set it.
    """
    out = dict(markers)
    if (v := _best(findings, _TCM_BODY)):
        out["body_color"] = v
    if (v := _best(findings, _TCM_COAT)):
        out["coat_color"] = v
    if (v := _best(findings, _TCM_SHAPE)):
        out["shape"] = v
    if findings.get("thin_coat", 0.0) >= TCM_OVERRIDE_CONF:
        out["coat_thick"] = "thin"
    return out


def tcm_heads(findings: dict | None) -> dict:
    """The three app heads; None when the model isn't available (UI: Coming soon).

    Greasiness maps to the dataset's 滑苔 (slippery coat) — the closest labelled
    finding to a greasy (腻) coat.
    """
    if findings is None:
        return {"tongue_greasiness": None, "tongue_cracks": None, "tongue_tooth_marks": None}
    pres = lambda k: "present" if findings.get(k, 0.0) >= TCM_HEAD_CONF else "absent"
    return {
        "tongue_greasiness": pres("slippery_coat"),
        "tongue_cracks": pres("cracks"),
        "tongue_tooth_marks": pres("tooth_marks"),
    }


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
    tongue_detected = is_tongue_present(img_bgr, yolo_hit=yolo_hit)

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

    # TCM findings from the fine-tuned model, when its weights are present.
    findings = None
    try:
        from app.ai.tongue_tcm import classify as classify_tcm
        findings = classify_tcm(img_bgr)
    except Exception as exc:
        logger.debug("TCM tongue classifier skipped (%s)", exc)
    if findings is not None:
        markers = apply_tcm_findings(markers, findings)
        score = overall_wellness(markers)

    heads = tcm_heads(findings)

    return {
        "tongue_body_color": markers["body_color"],
        "tongue_coat_color": markers["coat_color"],
        "tongue_coat_thick": markers["coat_thick"],
        "tongue_moisture":   markers["moisture"],
        "tongue_shape":      markers["shape"],
        "overall_wellness_score": score,
        "tongue_detected": tongue_detected,
        # "present" / "absent" from the TCM model; None (Coming soon) without it.
        **heads,
        "raw_metrics": {
            "sprint": 4,
            "scoring_method": ("yolo+tcm" if findings is not None else "yolo+cv") if yolo_hit else "cv",
            "tcm_findings": findings,
            **heads,   # persisted here: scan_results has no columns for them
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
