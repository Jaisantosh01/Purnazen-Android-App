"""Display-only image enhancement for the saved scan preview.

Produces a cleaned-up, face-cropped version of the capture for the user to see
on the results screen. Never fed to the analyzers (those use their own
white-balanced image to keep texture metrics at full fidelity).

Pipeline:
  1. White-balance correction
  2. Face detection (MediaPipe → Haar → centre crop fallback)
  3. Crop to face + generous padding so the result feels intimate
  4. Gentle bilateral denoise
  5. CLAHE local-contrast boost on luminance
  6. Soft background blur / darken behind the face oval
  7. Subtle vignette to focus attention on the centre
"""
import logging

import cv2
import numpy as np

from app.ai.image_preprocessor import normalize_white_balance

logger = logging.getLogger(__name__)


def _detect_face_box(img_bgr: np.ndarray) -> "tuple[int,int,int,int] | None":
    """Return (x, y, w, h) face bounding box.

    Priority: MediaPipe landmarks → Haar cascade → None.
    """
    h, w = img_bgr.shape[:2]

    # 1. MediaPipe (most accurate)
    try:
        from app.ai.face_detector import get_face_detector
        landmarks, _ = get_face_detector().detect(img_bgr)
        if landmarks:
            xs = [lm.x * w for lm in landmarks]
            ys = [lm.y * h for lm in landmarks]
            x1, x2 = int(min(xs)), int(max(xs))
            y1, y2 = int(min(ys)), int(max(ys))
            bw, bh = max(1, x2 - x1), max(1, y2 - y1)
            return x1, y1, bw, bh
    except Exception:
        pass

    # 2. Haar cascade
    try:
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        min_side = max(40, int(min(h, w) * 0.12))
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        if not cascade.empty():
            faces = cascade.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=3, minSize=(min_side, min_side)
            )
            if len(faces) > 0:
                return tuple(int(v) for v in max(faces, key=lambda f: f[2] * f[3]))
    except Exception:
        pass

    return None


def _crop_to_face(img: np.ndarray, box=None, pad_frac: float = 0.38) -> np.ndarray:
    """Crop the image to the face region with generous padding.

    ``box`` may be supplied by the caller to avoid re-running detection; if None
    we detect here. If no face is found, returns the image unchanged so we never
    break the pipeline when detection fails.
    """
    h, w = img.shape[:2]
    if box is None:
        box = _detect_face_box(img)

    if box is None:
        return img

    x, y, bw, bh = box
    pad_x = int(bw * pad_frac)
    pad_y = int(bh * (pad_frac + 0.12))  # slightly more vertical padding (chin/forehead)

    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(w, x + bw + pad_x)
    y2 = min(h, y + bh + pad_y)

    cropped = img[y1:y2, x1:x2]
    if cropped.size == 0:
        return img
    return cropped


def _blur_background(img: np.ndarray, box: "tuple[int,int,int,int] | None") -> np.ndarray:
    """Blur pixels outside the face oval for a portrait-bokeh effect.

    Uses an elliptical soft-edge mask derived from the face bounding box.
    Falls back to a centre-crop ellipse if detection failed.
    """
    h, w = img.shape[:2]

    if box is not None:
        fx, fy, fw, fh = box
        cx = fx + fw // 2
        cy = fy + fh // 2
        ax = int(fw * 0.62)
        ay = int(fh * 0.72)
    else:
        cx, cy = w // 2, h // 2
        ax = int(w * 0.34)
        ay = int(h * 0.40)

    # Soft elliptical mask
    yy, xx = np.mgrid[:h, :w]
    dist = np.sqrt(((xx - cx) / max(1, ax)) ** 2 + ((yy - cy) / max(1, ay)) ** 2)
    # 0 = inside ellipse (sharp), 1 = outside (blurred)
    mask = np.clip((dist - 0.85) / 0.55, 0.0, 1.0).astype(np.float32)

    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=14, sigmaY=14)
    darkened = (blurred.astype(np.float32) * 0.55).clip(0, 255).astype(np.uint8)

    mask3 = mask[:, :, None]
    out = (img.astype(np.float32) * (1 - mask3) + darkened.astype(np.float32) * mask3)
    return out.clip(0, 255).astype(np.uint8)


def _vignette(img_bgr: np.ndarray, strength: float = 0.40) -> np.ndarray:
    """Darken toward the edges with a smooth radial mask."""
    h, w = img_bgr.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    cy, cx = h / 2.0, w / 2.0
    dist = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2) / np.sqrt(2.0)
    mask = 1.0 - strength * np.clip(dist - 0.30, 0.0, 1.0)
    return np.clip(img_bgr.astype(np.float32) * mask[..., None], 0, 255).astype(np.uint8)


def enhance_for_display(img_bgr: np.ndarray) -> np.ndarray:
    """Return an enhanced, face-cropped BGR copy suitable for display.

    Applies: WB → face-detect for background blur → crop to face → denoise →
    CLAHE → vignette. The result is a tightly-framed portrait-style preview.
    """
    out = normalize_white_balance(img_bgr)

    # Detect once; reuse the box for both background blur and the crop.
    box = _detect_face_box(out)
    out = _blur_background(out, box)
    out = _crop_to_face(out, box=box)

    # Gentle bilateral denoise
    out = cv2.bilateralFilter(out, d=7, sigmaColor=45, sigmaSpace=7)

    # CLAHE on L* channel — lifts local contrast / evens lighting
    lab = cv2.cvtColor(out, cv2.COLOR_BGR2Lab)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
    lab = cv2.merge((clahe.apply(l), a, b))
    out = cv2.cvtColor(lab, cv2.COLOR_Lab2BGR)

    out = _vignette(out)
    return out
