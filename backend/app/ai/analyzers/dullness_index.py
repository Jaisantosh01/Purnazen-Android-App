"""Dullness index — composite score derived from dark circles, oiliness and glow.

Named for what it measures rather than what it might imply. The inputs are
luminance uniformity, saturation falloff and periorbital darkness: appearance
metrics from a photograph. Its previous name asserted a physiological state of
the user's body — a health claim this app is in no position to make, and one
Play's health-content policy does not permit from a non-medical-device app.
"""
import numpy as np


def compute(
    dark_circle_score: float,
    oiliness_score: float,
    glow_score: float,
) -> float:
    """Return dullness index 0-100 (higher = duller-looking skin).

    Formula:
        dullness = dark_circle_score × 0.40
                 + oiliness_score    × 0.30
                 + (100 - glow_score) × 0.30
    """
    dullness = (
        dark_circle_score * 0.40
        + oiliness_score  * 0.30
        + (100.0 - glow_score) * 0.30
    )
    return round(float(np.clip(dullness, 0.0, 100.0)), 2)
