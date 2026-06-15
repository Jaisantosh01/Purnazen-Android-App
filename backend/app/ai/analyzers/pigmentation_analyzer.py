"""Pigmentation analyzer — measures color unevenness via Lab a*/b* std-dev.

Score 0-100 where 100 = very uneven pigmentation.
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single ROI and return a pigmentation sub-score."""
    if roi.shape[0] < 5 or roi.shape[1] < 5:
        return 25.0

    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2Lab)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    h_ch = hsv[:, :, 0].astype(float)
    s_ch = hsv[:, :, 1].astype(float)
    v_ch = hsv[:, :, 2].astype(float)

    # Skin mask in HSV: H in [0,25] union [160,180], S in [30,255], V in [50,255]
    mask_h = ((h_ch <= 25) | (h_ch >= 160)) & (h_ch <= 180)
    mask_s = (s_ch >= 30) & (s_ch <= 255)
    mask_v = (v_ch >= 50) & (v_ch <= 255)
    skin_mask = mask_h & mask_s & mask_v

    a_channel = lab[:, :, 1].astype(float)
    b_channel = lab[:, :, 2].astype(float)

    if np.sum(skin_mask) > 100:
        a_std = float(np.std(a_channel[skin_mask]))
        b_std = float(np.std(b_channel[skin_mask]))
    else:
        a_std = float(np.std(a_channel))
        b_std = float(np.std(b_channel))

    roi_score = float(np.clip((a_std + b_std) * 3.0, 0.0, 100.0))
    return roi_score


def analyze(
    full_face: "np.ndarray | None",
    left_cheek: "np.ndarray | None",
    right_cheek: "np.ndarray | None",
) -> float:
    """Return pigmentation score 0-100.

    Averages across all non-None ROIs.  Returns 25.0 if all are None.
    """
    scores: list[float] = []
    for roi in (full_face, left_cheek, right_cheek):
        if roi is not None:
            try:
                scores.append(_analyze_roi(roi))
            except Exception:
                pass

    if not scores:
        return 25.0
    return float(np.mean(scores))
