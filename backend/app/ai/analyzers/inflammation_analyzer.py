"""Inflammation analyzer — detects redness via Lab a* channel elevation.

Score 0-100 where 100 = very inflamed.

Tone-aware: naturally warmer/darker skin has a higher baseline a* (redness in
the Lab sense). Measuring absolute a* therefore over-flags darker tones as
inflamed. We subtract a tone-derived baseline (``baseline_a``, from
``image_preprocessor.estimate_skin_tone``) so the score reflects redness *above*
what's normal for that complexion. With baseline_a=0 the behaviour is the old
absolute measure (kept for callers/tests that don't pass a tone).
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray, baseline_a: float) -> float:
    """Analyze a single ROI and return an inflammation sub-score."""
    if roi.shape[0] < 5 or roi.shape[1] < 5:
        return 15.0

    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2Lab)
    # OpenCV Lab a* channel: 0-255, neutral at 128.
    a_mean = float(np.mean(lab[:, :, 1]))
    # Elevation above the tone-expected neutral (128 + baseline_a).
    elevation = a_mean - 128.0 - baseline_a
    # ~25 a*-units above baseline maps to a maxed-out score.
    roi_score = float(np.clip(elevation * 4.0, 0.0, 100.0))
    return roi_score


def analyze(
    left_cheek: "np.ndarray | None",
    right_cheek: "np.ndarray | None",
    forehead: "np.ndarray | None",
    baseline_a: float = 0.0,
) -> float:
    """Return inflammation score 0-100.

    Averages cheek and forehead ROIs.  Returns 15.0 if all are None.
    ``baseline_a`` shifts the neutral point for the subject's skin tone.
    """
    scores: list[float] = []
    for roi in (left_cheek, right_cheek, forehead):
        if roi is not None:
            try:
                scores.append(_analyze_roi(roi, baseline_a))
            except Exception:
                pass

    if not scores:
        return 15.0
    return float(np.mean(scores))
