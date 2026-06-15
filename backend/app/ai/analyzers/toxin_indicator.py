"""Toxin indicator — composite score derived from dark circles, oiliness and glow."""
import numpy as np


def compute(
    dark_circle_score: float,
    oiliness_score: float,
    glow_score: float,
) -> float:
    """Return toxin indicator score 0-100.

    Formula:
        toxin = dark_circle_score × 0.40
              + oiliness_score    × 0.30
              + (100 - glow_score) × 0.30
    """
    toxin = (
        dark_circle_score * 0.40
        + oiliness_score  * 0.30
        + (100.0 - glow_score) * 0.30
    )
    return round(float(np.clip(toxin, 0.0, 100.0)), 2)
