"""Pigmentation analyzer — measures tonal unevenness (spots, blotches, melasma).

Score 0-100 where 100 = very uneven pigmentation.

Rewrite rationale: the previous version computed Lab a*/b* std *inside a narrow
HSV skin mask*. Pigment spots are often darker/shifted enough to fall **outside**
that mask, so they were excluded — and after blurring, the remaining clean skin
looked *more* uniform, making pigmented faces score *lower* than even ones (the
direction was inverted). We instead measure unevenness directly:

  1. Local luminance unevenness — std of the high-pass L* (illumination gradient
     removed), which captures spots/blotches without confusing them with shading.
  2. Colour-channel spread — std of Lab a*/b* across the whole ROI (no hue mask).
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single ROI and return a pigmentation sub-score."""
    if roi.shape[0] < 5 or roi.shape[1] < 5:
        return 25.0

    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2Lab).astype(np.float32)
    L, a, b = lab[:, :, 0], lab[:, :, 1], lab[:, :, 2]

    # Remove the low-frequency lighting gradient so we measure true tonal
    # unevenness (spots/blotches), not the smooth shading across the cheek.
    L_blur = cv2.GaussianBlur(L, (0, 0), 15)
    high_pass = L - L_blur
    # Clip the high-pass so specular glints / shine (which spike L locally on
    # oily skin) don't masquerade as pigment unevenness and pin the score at 100.
    high_pass = np.clip(high_pass, -25.0, 25.0)
    l_unevenness = float(np.std(high_pass))

    # Colour spread across the whole ROI (spots ARE skin — don't mask them out).
    a_std = float(np.std(a))
    b_std = float(np.std(b))

    # Softened gains so clear skin lands mid-low instead of saturating.
    roi_score = float(np.clip(l_unevenness * 3.0 + (a_std + b_std) * 1.4, 0.0, 100.0))
    return roi_score


def analyze(
    full_face: "np.ndarray | None",
    left_cheek: "np.ndarray | None",
    right_cheek: "np.ndarray | None",
) -> float:
    """Return pigmentation score 0-100.

    Averages across the cheek ROIs (the full-face frame is ignored — it includes
    hair/background/shadows that inflate unevenness). Returns 25.0 if no cheek ROI.
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
