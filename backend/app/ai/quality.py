"""Capture-quality gate — fast, synchronous checks before a scan is stored.

Run on the uploaded still *before* we persist it or enqueue the AI pipeline, so
the user gets immediate, specific guidance ("too dark", "move closer", "only your
face in frame") and we never waste storage/compute analysing an unusable photo.

Face detection priority: MediaPipe FaceLandmarker (accurate) → Haar cascade (fast
fallback) → returns 0 faces. This makes the "no_face" gate reliable even for
difficult photos (empty walls, distant faces, unusual angles).
"""
import logging

import cv2
import numpy as np

from app.ai.image_preprocessor import detect_blur

logger = logging.getLogger(__name__)

# ── Tunables ──────────────────────────────────────────────────────────────────
_MIN_BLUR       = 45.0    # Laplacian variance; below = too soft
_MIN_MEAN_L     = 80.0    # Lab L* mean; below = too dark
_MAX_MEAN_L     = 220.0   # above = blown out / glare
_MIN_FACE_AREA  = 0.04    # face bbox area / image area; below = too far
_MAX_CENTER_OFF = 0.30    # face-centre distance from image centre (frac of dim)

# Tongue-specific tunables
_TONGUE_MIN_REDDISH_FRAC = 0.005  # fraction of pixels in reddish/pinkish range

_GUIDANCE = {
    "no_face":        "We couldn't find your face. Centre it in the frame and ensure good lighting.",
    "multiple_faces": "Multiple faces detected. Make sure only your face is in the frame.",
    "too_dark":       "It's too dark. Move to brighter, even lighting.",
    "too_bright":     "It's too bright. Avoid direct glare or strong backlight.",
    "too_blurry":     "The photo looks blurry. Hold still and keep your subject in focus.",
    "face_too_small": "Your face is too far away. Move a little closer.",
    "off_center":     "Centre your face in the frame for the best result.",
    "no_tongue":      "We couldn't find your tongue. Stick it out fully under bright lighting.",
}

_BLOCKING = {
    "no_face", "multiple_faces", "too_dark", "too_bright",
    "too_blurry", "face_too_small", "no_tongue",
}

_PRIORITY = [
    "no_face", "multiple_faces", "no_tongue",
    "too_dark", "too_bright", "too_blurry", "face_too_small", "off_center",
]


# ── Face detection ─────────────────────────────────────────────────────────────

def _detect_faces_mediapipe(img_bgr) -> int:
    """Return face count using MediaPipe FaceLandmarker (most accurate).

    Returns -1 if MediaPipe is unavailable so the caller falls back to Haar.
    """
    try:
        from app.ai.face_detector import get_face_detector
        landmarks, _ = get_face_detector().detect(img_bgr)
        return 1 if landmarks else 0
    except Exception:
        return -1


def _detect_faces_haar(img_bgr) -> list:
    """Return list of (x, y, w, h) face boxes via Haar cascade."""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    min_side = max(32, int(min(img_bgr.shape[:2]) * 0.10))
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if cascade.empty():
        logger.warning("Haar cascade file not found; face detection skipped")
        return []
    faces = cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=4, minSize=(min_side, min_side)
    )
    return [tuple(int(v) for v in f) for f in faces]


def _count_faces(img_bgr) -> tuple:
    """Return (face_count, largest_box_or_None).

    Tries MediaPipe first for accuracy; falls back to Haar if unavailable.
    If MediaPipe detected exactly 1 face, bbox is a rough centre crop (accurate
    enough for size/centre checks).
    """
    mp_count = _detect_faces_mediapipe(img_bgr)

    if mp_count >= 0:
        if mp_count == 0:
            return 0, None
        # MediaPipe found face(s) — use a centred crop as the bounding box proxy
        h, w = img_bgr.shape[:2]
        bw, bh = int(w * 0.60), int(h * 0.60)
        x = (w - bw) // 2
        y = int(h * 0.15)
        return mp_count, (x, y, bw, bh)

    # MediaPipe unavailable — use Haar
    faces = _detect_faces_haar(img_bgr)
    if not faces:
        return 0, None
    largest = max(faces, key=lambda f: f[2] * f[3])
    return len(faces), largest


# ── Tongue detection ───────────────────────────────────────────────────────────

def _has_tongue(img_bgr: np.ndarray) -> bool:
    """Rough check: is there a reddish/pink region (tongue) in the lower half?

    Looks for pixels in the pinkish-red HSV range in the lower half of the frame,
    which is where the tongue appears when the user sticks it out.
    """
    h = img_bgr.shape[0]
    lower = img_bgr[h // 3:, :]  # lower two-thirds
    hsv = cv2.cvtColor(lower, cv2.COLOR_BGR2HSV)

    # Reddish (hue 0-10 and 160-180) + not too dark + moderately saturated
    mask1 = cv2.inRange(hsv, (0, 50, 80),  (15, 255, 255))
    mask2 = cv2.inRange(hsv, (155, 50, 80), (180, 255, 255))
    # Pinkish (hue 145-175, low-medium saturation)
    mask3 = cv2.inRange(hsv, (140, 30, 120), (175, 180, 255))
    reddish = cv2.bitwise_or(mask1, cv2.bitwise_or(mask2, mask3))

    frac = float(np.sum(reddish > 0)) / max(1, lower.shape[0] * lower.shape[1])
    return frac >= _TONGUE_MIN_REDDISH_FRAC


# ── Public API ─────────────────────────────────────────────────────────────────

def assess_quality(img_bgr: np.ndarray, scan_type: str = "face") -> dict:
    """Assess capture quality.

    Returns ``{"ok": bool, "issues": [{code, guidance, blocking}], "metrics": {...}}``.
    ``ok`` is False iff any blocking issue is present.
    """
    h, w = img_bgr.shape[:2]
    img_area = float(max(1, h * w))

    blur   = detect_blur(img_bgr)
    lab    = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab)
    mean_l = float(np.mean(lab[:, :, 0]))

    codes = []

    if scan_type == "tongue":
        # Tongue checks — no face detection needed
        if mean_l < _MIN_MEAN_L:
            codes.append("too_dark")
        elif mean_l > _MAX_MEAN_L:
            codes.append("too_bright")
        if blur < _MIN_BLUR:
            codes.append("too_blurry")
        if not _has_tongue(img_bgr):
            codes.append("no_tongue")

        face_count = 0
        face_area_ratio = 0.0
        center_offset = 0.0

    else:
        # Face checks
        face_count, bbox = _count_faces(img_bgr)
        face_area_ratio = 0.0
        center_offset = 0.0

        if face_count == 0:
            codes.append("no_face")
        elif face_count > 1:
            codes.append("multiple_faces")

        if bbox is not None:
            fx, fy, fw, fh = bbox
            face_area_ratio = (fw * fh) / img_area
            cx, cy = fx + fw / 2.0, fy + fh / 2.0
            center_offset = float(np.hypot((cx - w / 2.0) / w, (cy - h / 2.0) / h))

        if mean_l < _MIN_MEAN_L:
            codes.append("too_dark")
        elif mean_l > _MAX_MEAN_L:
            codes.append("too_bright")
        if blur < _MIN_BLUR:
            codes.append("too_blurry")
        if face_count >= 1 and face_area_ratio < _MIN_FACE_AREA:
            codes.append("face_too_small")
        if face_count >= 1 and center_offset > _MAX_CENTER_OFF:
            codes.append("off_center")

    codes.sort(key=lambda c: _PRIORITY.index(c) if c in _PRIORITY else 99)
    issues = [
        {"code": c, "guidance": _GUIDANCE.get(c, ""), "blocking": c in _BLOCKING}
        for c in codes
    ]
    ok = not any(i["blocking"] for i in issues)

    return {
        "ok": ok,
        "issues": issues,
        "metrics": {
            "blur":             round(blur, 2),
            "mean_l":           round(mean_l, 2),
            "face_count":       face_count if scan_type == "face" else None,
            "face_area_ratio":  round(face_area_ratio, 4) if scan_type == "face" else None,
            "center_offset":    round(center_offset, 4) if scan_type == "face" else None,
        },
    }


def first_blocking_issue(assessment: dict) -> "dict | None":
    """Return the highest-priority blocking issue, or None."""
    for issue in assessment.get("issues", []):
        if issue.get("blocking"):
            return issue
    return None
