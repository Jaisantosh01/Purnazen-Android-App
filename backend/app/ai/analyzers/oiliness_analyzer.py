"""Oiliness analyzer — estimates T-zone oiliness from skin gloss.

Score 0-100 where 100 = very oily.

Rationale (rewrite): the previous version counted only near-blown-out pixels
(HSV V > 220). Under diffuse indoor light, JPEG compression, or on darker skin
tones, oily skin almost never reaches V=220, so genuinely shiny skin scored as
matte. Sebum gloss is a *relative* phenomenon — bright specular spots standing
out from the surrounding diffuse skin — so we measure it adaptively against the
ROI's own brightness distribution instead of a fixed global threshold.

Three complementary cues (dichromatic reflection model):
  1. Adaptive specular ratio — fraction of pixels brighter than mean+k·std of V.
  2. Specular blob density — high-pass bright-spot energy (localised shine).
  3. Saturation drop in highlights — specular reflection desaturates skin
     (light reflects off the surface, not the pigment), the classic gloss cue.
"""
import cv2
import numpy as np


def analyze(t_zone: "np.ndarray | None") -> float:
    """Return oiliness score 0-100.

    Returns 30.0 if the T-zone ROI is None or too small.
    """
    if t_zone is None or t_zone.shape[0] < 5 or t_zone.shape[1] < 5:
        return 30.0

    hsv = cv2.cvtColor(t_zone, cv2.COLOR_BGR2HSV)
    v = hsv[:, :, 2].astype(np.float32)
    s = hsv[:, :, 1].astype(np.float32)
    total = v.size
    if total == 0:
        return 30.0

    v_mean = float(np.mean(v))
    v_std = float(np.std(v)) + 1e-6

    # 1. Adaptive specular ratio — bright pixels relative to this ROI's own skin.
    spec_thresh = v_mean + 1.2 * v_std
    spec_ratio = float(np.sum(v > spec_thresh)) / total

    # 2. Specular blob density — high-pass (gloss is local, not a flat bright ROI).
    gray = cv2.cvtColor(t_zone, cv2.COLOR_BGR2GRAY).astype(np.float32)
    high_pass = gray - cv2.GaussianBlur(gray, (0, 0), 3)
    blob_ratio = float(np.sum(high_pass > 18.0)) / total

    # 3. Saturation drop in the bright (specular) pixels vs. the diffuse skin.
    bright = v > spec_thresh
    if np.count_nonzero(bright) > 20:
        sat_drop = (float(np.mean(s)) - float(np.mean(s[bright]))) / 255.0
    else:
        sat_drop = 0.0
    sat_drop = max(0.0, sat_drop)

    # Blend the cues (weights tuned for ranking sanity; the trained model will
    # ultimately own this metric). Each term is scaled into ~0-100.
    score = (
        np.clip(spec_ratio * 100.0 * 4.0, 0.0, 60.0)   # up to 60 from specular area
        + np.clip(blob_ratio * 100.0 * 3.0, 0.0, 30.0)  # up to 30 from local shine
        + np.clip(sat_drop * 100.0 * 1.5, 0.0, 25.0)    # up to 25 from desaturation
    )
    return float(np.clip(score, 0.0, 100.0))
