"""Pore analyzer — estimates pore visibility via high-pass detail energy.

Score 0-100 where 100 = very visible pores.

Recalibrated: the previous gain (variance / 2) left almost every face near 0 —
pores never registered. Pores are small, evenly-distributed high-frequency
structures, so we measure the std of a fine high-pass image (which scales linearly
with visible texture) with a gain tuned so smooth skin lands low and visibly
porey skin lands mid/high.
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single cheek ROI and return a pore visibility sub-score."""
    if roi.shape[0] < 10 or roi.shape[1] < 10:
        return 25.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY).astype(np.float32)
    # Fine high-pass: isolate pore-scale detail (sigma ~2 px).
    high_pass = gray - cv2.GaussianBlur(gray, (0, 0), 2)
    detail = float(np.std(high_pass))

    # detail std ~10 (smooth) … ~35+ (very porey); gain spreads that over 0-100.
    roi_score = float(np.clip(detail * 3.0, 0.0, 100.0))
    return roi_score


def analyze(
    left_cheek: "np.ndarray | None",
    right_cheek: "np.ndarray | None",
) -> float:
    """Return pore visibility score 0-100.

    Averages both cheek ROIs.  Returns 25.0 if both are None.
    """
    scores: list[float] = []
    for roi in (left_cheek, right_cheek):
        if roi is not None:
            try:
                scores.append(_analyze_roi(roi))
            except Exception:
                pass

    if not scores:
        return 25.0
    return float(np.mean(scores))
