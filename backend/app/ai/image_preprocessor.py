"""Image pre-processing utilities for the Sprint 3 face analysis pipeline.

Handles resize, blur/lighting quality checks, and ROI extraction using
MediaPipe landmark indices.
"""
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# MediaPipe landmark index maps per facial zone
# ---------------------------------------------------------------------------
_ZONE_INDICES: dict[str, list[int]] = {
    "forehead":      [10, 151, 9, 8],
    "left_cheek":    [116, 123, 187, 207],
    "right_cheek":   [345, 352, 411, 427],
    "under_eye_l":   [226, 227, 228, 229, 230, 231],
    "under_eye_r":   [446, 447, 448, 449, 450, 451],
    "t_zone":        [1, 4, 19, 94, 164, 2],
    "jawline":       [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365],
    "eye_corners_l": [33, 133, 159, 145],
    "eye_corners_r": [362, 263, 386, 374],
    "temples_l":     [54, 103, 67, 109],
    "temples_r":     [284, 332, 297, 338],
}


def resize_for_analysis(img_bgr: np.ndarray, max_width: int = 800) -> np.ndarray:
    """Resize image proportionally if wider than *max_width*."""
    h, w = img_bgr.shape[:2]
    if w <= max_width:
        return img_bgr
    scale = max_width / w
    new_w = max_width
    new_h = int(h * scale)
    return cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)


def detect_blur(img_bgr: np.ndarray) -> float:
    """Return Laplacian variance of grayscale image.

    Values below 100 indicate a blurry image.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return variance


def detect_lighting(img_bgr: np.ndarray) -> str:
    """Classify lighting quality as 'good' or 'poor'.

    Converts to CIE L*a*b* and checks mean L* channel.
    OpenCV Lab L channel is in [0, 255] (≈ Lab 0-100 scaled).
    Mean L in [100, 210] (roughly Lab 40-82) is considered good.
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab)
    mean_l = float(np.mean(lab[:, :, 0]))
    if 100 <= mean_l <= 210:
        return "good"
    return "poor"


def _roi_from_indices(
    img: np.ndarray,
    landmarks: list,
    indices: list[int],
    h: int,
    w: int,
    pad_frac: float = 0.04,
) -> "np.ndarray | None":
    """Extract a bounding-box patch around the given landmark indices.

    Returns None if any index is out of range or the resulting patch is empty.
    """
    xs: list[float] = []
    ys: list[float] = []
    for idx in indices:
        if idx >= len(landmarks):
            logger.debug("Landmark index %d out of range (total=%d); skipping ROI", idx, len(landmarks))
            return None
        lm = landmarks[idx]
        xs.append(lm.x)
        ys.append(lm.y)

    if not xs:
        return None

    x_min = max(0.0, min(xs) - pad_frac)
    x_max = min(1.0, max(xs) + pad_frac)
    y_min = max(0.0, min(ys) - pad_frac)
    y_max = min(1.0, max(ys) + pad_frac)

    px_x1 = int(x_min * w)
    px_x2 = int(x_max * w)
    px_y1 = int(y_min * h)
    px_y2 = int(y_max * h)

    # Clamp to image boundaries
    px_x1 = max(0, min(px_x1, w - 1))
    px_x2 = max(0, min(px_x2, w))
    px_y1 = max(0, min(px_y1, h - 1))
    px_y2 = max(0, min(px_y2, h))

    patch = img[px_y1:px_y2, px_x1:px_x2]
    if patch.size == 0 or patch.shape[0] < 2 or patch.shape[1] < 2:
        return None
    return patch


def extract_rois(img_bgr: np.ndarray, landmarks: list) -> dict:
    """Extract named ROI patches from an image using MediaPipe landmarks.

    Returns a dict mapping zone names to BGR ndarray patches (or None).
    """
    h, w = img_bgr.shape[:2]
    rois: dict = {}
    for zone_name, indices in _ZONE_INDICES.items():
        rois[zone_name] = _roi_from_indices(img_bgr, landmarks, indices, h, w)
    return rois
