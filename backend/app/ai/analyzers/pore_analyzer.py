"""Pore analyzer — estimates pore visibility via high-pass frequency variance.

Score 0-100 where 100 = very visible pores.
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single cheek ROI and return a pore visibility sub-score."""
    if roi.shape[0] < 10 or roi.shape[1] < 10:
        return 25.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # High-pass filter: subtract Gaussian blur from original
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    high_pass = cv2.subtract(gray, blurred)

    variance = float(np.var(high_pass.astype(float)))
    # variance ~200 maps to 100
    roi_score = float(np.clip(variance / 2.0, 0.0, 100.0))
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
