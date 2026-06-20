"""Tongue segmentation — isolate the tongue from lips/face via GrabCut.

The capture UI guides the user to centre their extended tongue, so we seed
GrabCut with a central rectangle and additionally keep only reddish pixels
(tongues are pink/red) to drop any lip/skin bleed. Falls back to a central
elliptical mask if GrabCut fails or returns too little.
"""
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def _reddish_mask(img_bgr: np.ndarray) -> np.ndarray:
    """Boolean mask of pink/red pixels (tongue body + coat)."""
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    # Red hue wraps around 0/180; allow desaturated coat too (lower S floor).
    red = ((h <= 20) | (h >= 160)) & (s >= 25) & (v >= 40)
    return red


def _center_ellipse(h: int, w: int) -> np.ndarray:
    mask = np.zeros((h, w), np.uint8)
    cv2.ellipse(mask, (w // 2, h // 2), (int(w * 0.34), int(h * 0.40)), 0, 0, 360, 1, -1)
    return mask


def segment_tongue(img_bgr: np.ndarray) -> "tuple[np.ndarray, bool]":
    """Return (binary mask uint8 {0,1}, used_fallback)."""
    h, w = img_bgr.shape[:2]
    fallback = _center_ellipse(h, w) & _reddish_mask(img_bgr).astype(np.uint8)

    try:
        rect = (int(w * 0.15), int(h * 0.12), int(w * 0.70), int(h * 0.76))
        gc = np.zeros((h, w), np.uint8)
        bgd = np.zeros((1, 65), np.float64)
        fgd = np.zeros((1, 65), np.float64)
        cv2.grabCut(img_bgr, gc, rect, bgd, fgd, 3, cv2.GC_INIT_WITH_RECT)
        fg = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
        fg = fg & _reddish_mask(img_bgr).astype(np.uint8)
        # Clean up speckle.
        fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        if int(fg.sum()) >= int(h * w * 0.04):
            return fg, False
    except Exception as exc:
        logger.info("GrabCut tongue segmentation failed (%s); using fallback", exc)

    # Fallback: central reddish ellipse (still better than the whole frame).
    if int(fallback.sum()) < int(h * w * 0.02):
        fallback = _center_ellipse(h, w)
    return fallback.astype(np.uint8), True
