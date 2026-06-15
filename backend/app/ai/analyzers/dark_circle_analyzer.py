"""Dark circle analyzer — measures under-eye darkness vs cheek brightness.

Score 0-100 where 100 = very dark circles.
"""
import cv2
import numpy as np


def _lab_l_mean(roi: np.ndarray) -> "float | None":
    """Return mean Lab L channel value for an ROI, or None if too small."""
    if roi is None or roi.shape[0] < 3 or roi.shape[1] < 3:
        return None
    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2Lab)
    return float(np.mean(lab[:, :, 0]))


def analyze(
    under_eye_l: "np.ndarray | None",
    under_eye_r: "np.ndarray | None",
    left_cheek: "np.ndarray | None",
    right_cheek: "np.ndarray | None",
) -> float:
    """Return dark circle score 0-100.

    Compares under-eye L* to cheek L*; positive delta = darker under-eye.
    Returns 30.0 if no usable ROI data is available.
    """
    deltas: list[float] = []

    # Left side: cheek L* - under-eye L* (positive = darker under-eye)
    cheek_l_mean = _lab_l_mean(left_cheek)
    eye_l_mean = _lab_l_mean(under_eye_l)
    if cheek_l_mean is not None and eye_l_mean is not None:
        deltas.append(cheek_l_mean - eye_l_mean)

    # Right side
    cheek_r_mean = _lab_l_mean(right_cheek)
    eye_r_mean = _lab_l_mean(under_eye_r)
    if cheek_r_mean is not None and eye_r_mean is not None:
        deltas.append(cheek_r_mean - eye_r_mean)

    if not deltas:
        return 30.0

    mean_delta = float(np.mean(deltas))
    score = float(np.clip(mean_delta * 3.0, 0.0, 100.0))
    return score
