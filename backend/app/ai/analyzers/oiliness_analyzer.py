"""Oiliness analyzer — estimates T-zone oiliness from specular highlights.

Score 0-100 where 100 = very oily.
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
    v_channel = hsv[:, :, 2].astype(float)
    s_channel = hsv[:, :, 1].astype(float)

    total_pixels = v_channel.size
    if total_pixels == 0:
        return 30.0

    # Oily skin shows specular highlights: pixels where V > 220
    oily_pixels = int(np.sum(v_channel > 220))
    ratio = oily_pixels / total_pixels

    # Mean saturation (normalized to [0, 20] range for blending)
    sat_mean = float(np.mean(s_channel)) / 255.0 * 20.0

    score = float(np.clip(ratio * 250.0 + sat_mean, 0.0, 100.0))
    return score
