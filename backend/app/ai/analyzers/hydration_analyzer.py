"""Hydration analyzer — estimates skin moisture level from cheek ROIs.

Score 0-100 where 100 = very hydrated.
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single cheek ROI and return a hydration sub-score."""
    # Minimum viable patch
    if roi.shape[0] < 5 or roi.shape[1] < 5:
        return 50.0

    # --- Brightness component (Lab L channel) ---
    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2Lab)
    l_mean = float(np.mean(lab[:, :, 0]))
    # OpenCV Lab L in [0, 255]; brighter skin = more hydrated
    # Normalize: (l_mean - 80) / 100, clipped to [0, 1]
    l_norm = float(np.clip((l_mean - 80.0) / 100.0, 0.0, 1.0))

    # --- Texture homogeneity via GLCM ---
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
    homogeneity = float(graycoprops(glcm, "homogeneity").mean())

    roi_score = float(np.clip(l_norm * 50.0 + homogeneity * 50.0, 0.0, 100.0))
    return roi_score


def analyze(
    left_cheek: "np.ndarray | None",
    right_cheek: "np.ndarray | None",
) -> float:
    """Return hydration score 0-100.

    Averages scores from both cheek ROIs.  Returns 50.0 if both are None.
    """
    scores: list[float] = []
    for roi in (left_cheek, right_cheek):
        if roi is not None:
            try:
                scores.append(_analyze_roi(roi))
            except Exception:
                pass

    if not scores:
        return 50.0
    return float(np.mean(scores))
