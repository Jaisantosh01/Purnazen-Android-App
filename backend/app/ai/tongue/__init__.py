"""Tongue analysis pipeline (Sprint 4) — classical CV TCM tongue diagnosis.

Mirrors the face pipeline's philosophy: interpretable colour/texture heuristics
over a segmented tongue region, producing the TCM dimensions the recommendation
engine already consumes (body colour, coat colour/thickness, moisture, shape).

Entry point: ``analyze(img_bgr) -> dict`` returning the scores dict the
scan_pipeline_service persists to ScanResult.
"""
import logging

import numpy as np

from app.ai.tongue.color_analyzer import analyze_colors
from app.ai.tongue.segmenter import segment_tongue, tongue_coverage
from app.ai.tongue.tcm_rules import overall_wellness

logger = logging.getLogger(__name__)

# Minimum reddish coverage in the guide region for a frame to count as showing
# an actual tongue. A well-extended tongue clears this comfortably; a closed
# mouth or non-tongue frame falls below it. Tunable if false rejects show up.
MIN_TONGUE_COVERAGE = 0.12


def _mask_bbox(mask: "np.ndarray") -> "list | None":
    """Normalized [x, y, w, h] bounding box of the segmented tongue, or None.

    Lets the mobile processing screen crop+zoom to the detected tongue and draw
    an outline over it — the tongue equivalent of the face mesh preview.
    """
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


def analyze(img_bgr: "np.ndarray") -> dict:
    """Run the full tongue pipeline. Always returns a valid scores dict."""
    coverage = tongue_coverage(img_bgr)
    tongue_detected = coverage >= MIN_TONGUE_COVERAGE

    mask, used_fallback = segment_tongue(img_bgr)
    markers = analyze_colors(img_bgr, mask)
    score = overall_wellness(markers)
    bbox = _mask_bbox(mask)

    return {
        "tongue_body_color": markers["body_color"],
        "tongue_coat_color": markers["coat_color"],
        "tongue_coat_thick": markers["coat_thick"],
        "tongue_moisture":   markers["moisture"],
        "tongue_shape":      markers["shape"],
        "overall_wellness_score": score,
        # Surfaced so the pipeline can reject frames with no tongue present.
        "tongue_detected": tongue_detected,
        "raw_metrics": {
            "sprint": 4,
            "scoring_method": "cv",
            "tongue_segmentation_fallback": used_fallback,
            "tongue_coverage": round(coverage, 4),
            "tongue_detected": tongue_detected,
            "tongue_bbox": bbox,
            "tongue_metrics": markers["raw"],
        },
    }
