"""Tongue colour/texture classification → TCM dimensions.

All thresholds operate on the segmented tongue pixels only. Heuristic and
interpretable (consistent with the face analyzers); the values map onto the
categories the recommendation engine's tongue rules already consume.
"""
import cv2
import numpy as np


def _classify_body_color(a_mean: float, l_mean: float) -> str:
    """Body colour from Lab a* (redness, 0-255 neutral 128) + L* (lightness)."""
    a_rel = a_mean - 128.0          # >0 = redder
    if a_rel < 6:
        return "pale"
    if a_rel < 18:
        return "normal"
    if l_mean < 110 and a_rel >= 24:
        return "dark_red"
    return "red"


def analyze_colors(img_bgr: np.ndarray, mask: np.ndarray) -> dict:
    """Return TCM tongue markers from the masked tongue region."""
    sel = mask.astype(bool)
    n = int(sel.sum())
    if n < 200:
        # Not enough tongue pixels — neutral, honest defaults.
        return {
            "body_color": "normal", "coat_color": "white", "coat_thick": "thin",
            "moisture": "moist", "shape": "normal",
            "raw": {"tongue_pixels": n, "low_signal": True},
        }

    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab).astype(np.float32)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    L = lab[:, :, 0][sel]
    A = lab[:, :, 1][sel]
    Bb = lab[:, :, 2][sel]
    S = hsv[:, :, 1][sel]
    V = hsv[:, :, 2][sel]
    Hh = hsv[:, :, 0][sel]

    # Coat = lighter, less-saturated film over the body. Body = the redder rest.
    coat_sel = (S < 70) & (L > np.percentile(L, 55))
    body_sel = ~coat_sel
    coat_frac = float(coat_sel.mean())

    a_body = float(np.mean(A[body_sel])) if body_sel.any() else float(np.mean(A))
    l_body = float(np.mean(L[body_sel])) if body_sel.any() else float(np.mean(L))
    body_color = _classify_body_color(a_body, l_body)

    # Coat colour: yellow hue among coat pixels → "yellow", else "white".
    if coat_sel.any():
        coat_hue = float(np.median(Hh[coat_sel]))
        coat_b = float(np.mean(Bb[coat_sel]))   # Lab b*: >128 = yellowish
        coat_color = "yellow" if (15 <= coat_hue <= 45 or coat_b > 145) else "white"
    else:
        coat_color = "white"

    # Coat thickness from coverage.
    if coat_frac < 0.12:
        coat_thick = "thin"
    elif coat_frac < 0.45:
        coat_thick = "moderate"
    else:
        coat_thick = "thick"

    # Moisture from specular gloss (wet tongues are shiny).
    v_thresh = float(np.mean(V) + 1.5 * np.std(V))
    gloss = float(np.mean(V > v_thresh))
    moisture = "moist" if gloss > 0.04 else "dry"

    # Shape from the mask bounding box aspect ratio.
    ys, xs = np.where(sel)
    bw = xs.max() - xs.min() + 1
    bh = ys.max() - ys.min() + 1
    ratio = bw / max(1, bh)
    if ratio > 0.95:
        shape = "swollen"
    elif ratio < 0.55:
        shape = "thin"
    else:
        shape = "normal"

    return {
        "body_color": body_color,
        "coat_color": coat_color,
        "coat_thick": coat_thick,
        "moisture": moisture,
        "shape": shape,
        "raw": {
            "tongue_pixels": n,
            "a_body": round(a_body, 1),
            "l_body": round(l_body, 1),
            "coat_frac": round(coat_frac, 3),
            "gloss": round(gloss, 3),
            "aspect": round(ratio, 2),
        },
    }
