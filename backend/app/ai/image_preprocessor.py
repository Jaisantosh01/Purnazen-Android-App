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


def normalize_white_balance(img_bgr: np.ndarray, p: int = 6) -> np.ndarray:
    """Neutralize the colour cast of an image (Shades-of-Gray colour constancy).

    Phone selfies are taken under wildly varying white balance (warm tungsten,
    cool daylight, green fluorescents). Every colour-based skin metric — redness,
    pigmentation, dark circles — is corrupted by that cast. Shades-of-Gray (a
    generalisation of Gray-World using a Minkowski-p norm, p=6 is the standard
    robust choice) estimates the illuminant per channel and divides it out so
    downstream analyzers see roughly the same colours regardless of lighting.

    Gains are clipped to [0.5, 2.0] so a strongly tinted background can't blow
    out the correction.
    """
    img = img_bgr.astype(np.float32)
    # Per-channel Minkowski-p mean = illuminant estimate.
    illum = np.power(np.mean(np.power(img, p), axis=(0, 1)), 1.0 / p)
    illum = np.where(illum < 1e-6, 1e-6, illum)
    gray = float(np.mean(illum))
    gains = np.clip(gray / illum, 0.5, 2.0)
    out = img * gains
    return np.clip(out, 0, 255).astype(np.uint8)


def normalize_exposure(img_bgr: np.ndarray, target_l: float = 150.0) -> np.ndarray:
    """Normalize overall luminance so the same subject scores consistently across
    bright and dim captures.

    White balance (above) removes the colour *cast*, but not absolute brightness:
    a face shot backlit, in a dim room, or in harsh sun lands at very different
    exposures, and both colour- and luminance-based skin metrics shift with it.
    That is the "same face, different lighting → different score" complaint. This
    scales the CIE-L* (lightness) channel by a single gain that brings the frame's
    mid-tone median to a fixed target, then converts back to BGR.

    A *single global gain* (clipped to [0.6, 1.6]) is deliberate: it removes the
    absolute-exposure bias while preserving *relative* contrast — under-eye vs
    cheek darkness, redness gradients — so real signal isn't flattened. The median
    is taken over mid-tone pixels only, so blown highlights or deep shadows don't
    skew the reference.
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab).astype(np.float32)
    L = lab[:, :, 0]
    mid = L[(L > 25) & (L < 235)]
    ref = float(np.median(mid)) if mid.size >= 50 else float(np.median(L))
    if ref < 1e-3:
        return img_bgr
    gain = float(np.clip(target_l / ref, 0.6, 1.6))
    lab[:, :, 0] = np.clip(L * gain, 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_Lab2BGR)


# Individual Typology Angle (ITA°) skin-tone buckets — Chardon/Fitzpatrick proxy.
# Higher ITA = lighter skin. Used to make tone-sensitive metrics fairer.
_ITA_BUCKETS = [
    (55.0, "very_light"),
    (41.0, "light"),
    (28.0, "intermediate"),
    (10.0, "tan"),
    (-30.0, "brown"),
    (-1e9, "dark"),
]


def _ita_from_roi(roi_bgr: "np.ndarray | None") -> "float | None":
    """Median Individual Typology Angle (degrees) over the skin pixels of an ROI."""
    if roi_bgr is None or roi_bgr.shape[0] < 5 or roi_bgr.shape[1] < 5:
        return None
    lab = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2Lab).astype(np.float32)
    # OpenCV packs Lab into 0-255: L scaled by 255/100, a/b offset by +128.
    L = lab[:, :, 0] * (100.0 / 255.0)
    b = lab[:, :, 2] - 128.0
    # Restrict to plausible skin-luminance pixels to avoid shadows/highlights.
    mask = (L > 20.0) & (L < 95.0)
    if np.count_nonzero(mask) < 30:
        mask = np.ones_like(L, dtype=bool)
    ita = np.degrees(np.arctan2(L[mask] - 50.0, b[mask]))
    return float(np.median(ita))


def estimate_skin_tone(rois: dict) -> dict:
    """Estimate skin tone from cheek/forehead ROIs.

    Returns ``{"ita": float|None, "bucket": str, "baseline_a": float}`` where
    ``baseline_a`` is the expected (tone-driven) neutral redness used by the
    inflammation analyzer to avoid flagging naturally warmer/darker skin as
    inflamed. Falls back to a neutral "intermediate" bucket when no usable ROI.
    """
    candidates = [rois.get("left_cheek"), rois.get("right_cheek"), rois.get("forehead")]
    itas = [v for v in (_ita_from_roi(r) for r in candidates) if v is not None]
    if not itas:
        return {"ita": None, "bucket": "intermediate", "baseline_a": 8.0}

    ita = float(np.median(itas))
    bucket = next(name for thresh, name in _ITA_BUCKETS if ita >= thresh)
    # Darker skin (lower ITA) carries a higher baseline a* (warmth); map ITA→a*
    # offset above neutral. ~5 (very light) … ~18 (dark) in OpenCV a*-128 units.
    baseline_a = float(np.clip(13.0 - ita * 0.12, 4.0, 20.0))
    return {"ita": ita, "bucket": bucket, "baseline_a": baseline_a}


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
