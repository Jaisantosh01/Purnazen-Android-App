"""Glow score engine — computes the weighted composite glow score.

Input: a dict with keys matching the metric names below.
Output: float in [0, 100] rounded to 2 decimal places.
"""
import numpy as np


def compute(scores: dict) -> float:
    """Compute composite glow score from individual metric scores.

    Formula (weights sum to 1.0):
        glow_score =
            hydration_score       × 0.20
          + (100 - oiliness)      × 0.10
          + (100 - wrinkle)       × 0.15
          + (100 - pigmentation)  × 0.15
          + (100 - dark_circle)   × 0.10
          + (100 - pore)          × 0.10
          + elasticity            × 0.10
          + muscle_tone           × 0.05
          + (100 - inflammation)  × 0.05
    """
    hydration    = float(scores.get("hydration_score",    50.0))
    oiliness     = float(scores.get("oiliness_score",     50.0))
    wrinkle      = float(scores.get("wrinkle_score",      50.0))
    pigmentation = float(scores.get("pigmentation_score", 50.0))
    dark_circle  = float(scores.get("dark_circle_score",  50.0))
    pore         = float(scores.get("pore_score",         50.0))
    elasticity   = float(scores.get("elasticity_score",   50.0))
    muscle_tone  = float(scores.get("muscle_tone_score",  50.0))
    inflammation = float(scores.get("inflammation_score", 50.0))

    raw = (
        hydration          * 0.20
        + (100 - oiliness) * 0.10
        + (100 - wrinkle)  * 0.15
        + (100 - pigmentation) * 0.15
        + (100 - dark_circle)  * 0.10
        + (100 - pore)         * 0.10
        + elasticity           * 0.10
        + muscle_tone          * 0.05
        + (100 - inflammation) * 0.05
    )

    return round(float(np.clip(raw, 0.0, 100.0)), 2)
