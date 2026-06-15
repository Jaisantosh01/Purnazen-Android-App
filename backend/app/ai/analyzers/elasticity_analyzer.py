"""Elasticity analyzer — measures skin texture uniformity via GLCM energy.

Score 0-100 where 100 = excellent elasticity.
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single ROI and return an elasticity sub-score."""
    if roi.shape[0] < 5 or roi.shape[1] < 5:
        return 60.0

    from skimage.feature import graycomatrix, graycoprops  # type: ignore

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (64, 64), interpolation=cv2.INTER_AREA)
    small_u8 = small.astype(np.uint8)

    glcm = graycomatrix(
        small_u8,
        distances=[1],
        angles=[0, np.pi / 2],
        levels=256,
        symmetric=True,
        normed=True,
    )
    energy = float(graycoprops(glcm, "energy").mean())

    # energy ~0.2 maps to 100
    roi_score = float(np.clip(energy * 500.0, 0.0, 100.0))
    return roi_score


def analyze(
    jawline: "np.ndarray | None",
    forehead: "np.ndarray | None",
) -> float:
    """Return elasticity score 0-100.

    Averages jawline and forehead ROIs.  Returns 60.0 if both are None.
    """
    scores: list[float] = []
    for roi in (jawline, forehead):
        if roi is not None:
            try:
                scores.append(_analyze_roi(roi))
            except Exception:
                pass

    if not scores:
        return 60.0
    return float(np.mean(scores))
