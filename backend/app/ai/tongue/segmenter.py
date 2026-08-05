"""Tongue segmentation — YOLO bbox when available, else classical CV.

The capture UI centres the tongue, but gallery / internet uploads often place
it anywhere in frame. Detection therefore searches the full image for the best
tongue-like blob, and prefers the open-source TongueDiagnosis YOLOv5 localizer
when weights are loaded (see ``app.ai.tongue_detector``).
"""
from __future__ import annotations

import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def _tongue_body_mask(img_bgr: np.ndarray) -> np.ndarray:
    """Pink/red tongue *body* only — excludes pale walls/coats that fake presence."""
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    # Tight red/pink: high enough saturation that beige walls / empty rooms fail.
    return ((h <= 15) | (h >= 165)) & (s >= 50) & (v >= 50) & (v <= 245)


def _tongue_coat_mask(img_bgr: np.ndarray) -> np.ndarray:
    """Pale coat pixels (white/yellow film) — used for segmentation, not presence."""
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    return ((h <= 40) | (h >= 150)) & (s >= 8) & (s < 90) & (v >= 130)


def _tongue_like_mask(img_bgr: np.ndarray) -> np.ndarray:
    """Body + coat — for GrabCut / colour analysis after a tongue is confirmed."""
    return _tongue_body_mask(img_bgr) | _tongue_coat_mask(img_bgr)


def _center_ellipse(h: int, w: int) -> np.ndarray:
    mask = np.zeros((h, w), np.uint8)
    cv2.ellipse(mask, (w // 2, h // 2), (int(w * 0.34), int(h * 0.40)), 0, 0, 360, 1, -1)
    return mask


def _guide_crop(img_bgr: np.ndarray) -> np.ndarray:
    """Central region that matches the mobile tongue-guide oval."""
    h, w = img_bgr.shape[:2]
    x, y, rw, rh = int(w * 0.15), int(h * 0.12), int(w * 0.70), int(h * 0.76)
    return img_bgr[y:y + rh, x:x + rw]


def tongue_body_coverage(img_bgr: np.ndarray) -> float:
    """Fraction of pink/red *body* pixels in the guide oval."""
    region = _guide_crop(img_bgr)
    if region.size == 0:
        return 0.0
    return float(_tongue_body_mask(region).mean())


def tongue_body_coverage_full(img_bgr: np.ndarray) -> float:
    """Fraction of pink/red body pixels in the whole frame."""
    if img_bgr is None or img_bgr.size == 0:
        return 0.0
    return float(_tongue_body_mask(img_bgr).mean())


def tongue_coverage(img_bgr: np.ndarray) -> float:
    """Fraction of tongue-like (body+coat) pixels in the central capture region."""
    region = _guide_crop(img_bgr)
    if region.size == 0:
        return 0.0
    return float(_tongue_like_mask(region).mean())


def tongue_chroma(img_bgr: np.ndarray) -> float:
    """Mean Lab a* of tongue-*body* pixels in the guide region (128 = neutral)."""
    crop = _guide_crop(img_bgr)
    if crop.size == 0:
        return 0.0
    body = _tongue_body_mask(crop)
    if int(body.sum()) < 80:
        return 0.0
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2Lab)
    return float(np.mean(lab[:, :, 1][body]))


def find_best_tongue_blob(img_bgr: np.ndarray) -> dict | None:
    """Best tongue-*body* connected component in the full frame.

    Uses body mask only so empty beige walls (which match the coat band) cannot
    unlock the live green oval.
    """
    h, w = img_bgr.shape[:2]
    img_area = float(max(1, h * w))
    mask = _tongue_body_mask(img_bgr).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n <= 1:
        return None

    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab)
    best = None
    best_score = 0.0
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        area_frac = area / img_area
        if area_frac < 0.025 or area_frac > 0.75:
            continue
        bw = int(stats[i, cv2.CC_STAT_WIDTH])
        bh = int(stats[i, cv2.CC_STAT_HEIGHT])
        if bw < 28 or bh < 28:
            continue
        aspect = bw / max(1, bh)
        if aspect < 0.45 or aspect > 2.0:
            continue
        x = int(stats[i, cv2.CC_STAT_LEFT])
        y = int(stats[i, cv2.CC_STAT_TOP])
        comp = labels == i
        chroma = float(np.mean(lab[:, :, 1][comp]))
        if chroma < 138:
            continue
        cx = (x + bw / 2.0) / w
        cy = (y + bh / 2.0) / h
        center_bonus = 1.0 - min(1.0, ((cx - 0.5) ** 2 + (cy - 0.5) ** 2) ** 0.5)
        score = area_frac * (0.5 + center_bonus) * (0.6 + max(0.0, (chroma - 128.0) / 40.0))
        if score > best_score:
            best_score = score
            best = {
                "bbox": (x, y, bw, bh),
                "coverage": area_frac,
                "chroma": chroma,
                "area_frac": area_frac,
                "score": score,
            }
    return best


def segment_tongue(
    img_bgr: np.ndarray,
    seed_bbox: tuple[int, int, int, int] | None = None,
) -> tuple[np.ndarray, bool]:
    """Return (binary mask uint8 {0,1}, used_fallback).

    ``seed_bbox`` is optional pixel ``(x, y, w, h)`` from the YOLO detector —
    GrabCut is seeded with that box instead of the camera-guide rectangle.
    """
    h, w = img_bgr.shape[:2]
    like = _tongue_like_mask(img_bgr).astype(np.uint8)
    fallback = _center_ellipse(h, w) & like

    if seed_bbox is not None:
        x, y, bw, bh = seed_bbox
        # Pad the detector box slightly so GrabCut has edge context.
        pad_x, pad_y = int(bw * 0.08), int(bh * 0.08)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w, x + bw + pad_x)
        y2 = min(h, y + bh + pad_y)
        rect = (x1, y1, max(1, x2 - x1), max(1, y2 - y1))
    else:
        blob = find_best_tongue_blob(img_bgr)
        if blob is not None:
            x, y, bw, bh = blob["bbox"]
            pad_x, pad_y = int(bw * 0.10), int(bh * 0.10)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(w, x + bw + pad_x)
            y2 = min(h, y + bh + pad_y)
            rect = (x1, y1, max(1, x2 - x1), max(1, y2 - y1))
        else:
            rect = (int(w * 0.15), int(h * 0.12), int(w * 0.70), int(h * 0.76))

    try:
        gc = np.zeros((h, w), np.uint8)
        bgd = np.zeros((1, 65), np.float64)
        fgd = np.zeros((1, 65), np.float64)
        cv2.grabCut(img_bgr, gc, rect, bgd, fgd, 3, cv2.GC_INIT_WITH_RECT)
        fg = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
        # Soften the colour AND so pale coated tongues aren't wiped out.
        fg = fg & np.maximum(like, cv2.dilate(like, np.ones((7, 7), np.uint8)))
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        if int(fg.sum()) >= int(h * w * 0.025):
            return fg, False
    except Exception as exc:
        logger.info("GrabCut tongue segmentation failed (%s); using fallback", exc)

    if seed_bbox is not None:
        x, y, bw, bh = seed_bbox
        box_mask = np.zeros((h, w), np.uint8)
        box_mask[y:y + bh, x:x + bw] = 1
        seeded = box_mask & like
        if int(seeded.sum()) >= int(h * w * 0.02):
            return seeded.astype(np.uint8), True
        return box_mask, True

    if int(fallback.sum()) < int(h * w * 0.02):
        blob = find_best_tongue_blob(img_bgr)
        if blob is not None:
            x, y, bw, bh = blob["bbox"]
            box_mask = np.zeros((h, w), np.uint8)
            box_mask[y:y + bh, x:x + bw] = 1
            return (box_mask & like).astype(np.uint8), True
        fallback = _center_ellipse(h, w)
    return fallback.astype(np.uint8), True
