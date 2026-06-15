"""Inflammation analyzer — detects redness via Lab a* channel mean.

Score 0-100 where 100 = very inflamed.
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single ROI and return an inflammation sub-score."""
    if roi.shape[0] < 5 or roi.shape[1] < 5:
        return 15.0

    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2Lab)
    # OpenCV Lab a* channel: 0-255, neutral at 128
    a_mean = float(np.mean(lab[:, :, 1]))
    # How far above neutral: range -1 to +1
    redness = (a_mean - 128.0) / 127.0
    roi_score = float(np.clip(redness * 100.0, 0.0, 100.0))
    return roi_score


def analyze(
    left_cheek: "np.ndarray | None",
    right_cheek: "np.ndarray | None",
    forehead: "np.ndarray | None",
) -> float:
    """Return inflammation score 0-100.

    Averages cheek and forehead ROIs.  Returns 15.0 if all are None.
    """
    scores: list[float] = []
    for roi in (left_cheek, right_cheek, forehead):
        if roi is not None:
            try:
                scores.append(_analyze_roi(roi))
            except Exception:
                pass

    if not scores:
        return 15.0
    return float(np.mean(scores))
