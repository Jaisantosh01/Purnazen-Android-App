"""Wrinkle analyzer — detects fine lines via edge density and GLCM contrast.

Score 0-100 where 100 = very wrinkled.
"""
import cv2
import numpy as np


def _analyze_roi(roi: np.ndarray) -> float:
    """Analyze a single ROI and return a wrinkle sub-score."""
    if roi.shape[0] < 5 or roi.shape[1] < 5:
        return 20.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # --- Edge density via Canny ---
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0)) / float(edges.size)

    # --- Texture contrast via GLCM ---
    from skimage.feature import graycomatrix, graycoprops  # type: ignore

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
    contrast = float(graycoprops(glcm, "contrast").mean())

    # Edge density dominates (lines = wrinkles); contrast is a secondary cue.
    # Real fine lines occupy a small edge fraction; brows/hairline/harsh-angle
    # selfies push edge density much higher, so we (a) cap the edge contribution
    # so stray hair can't alone slam the score to 100, and (b) use softened gains.
    capped_edge = min(edge_density, 0.24)
    roi_score = float(np.clip(capped_edge * 200.0 + contrast * 0.9, 0.0, 100.0))
    return roi_score


def analyze(
    forehead: "np.ndarray | None",
    eye_corners: "np.ndarray | None",
) -> float:
    """Return wrinkle score 0-100.

    Averages scores from forehead and eye-corner ROIs.
    Returns 20.0 if both are None.
    """
    scores: list[float] = []
    for roi in (forehead, eye_corners):
        if roi is not None:
            try:
                scores.append(_analyze_roi(roi))
            except Exception:
                pass

    if not scores:
        return 20.0
    return float(np.mean(scores))
