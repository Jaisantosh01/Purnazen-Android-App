"""Shared spec for the skin-model training project.

⚠️ Keep ``METRIC_ORDER``, ``INPUT_SIZE`` and the ImageNet normalization in sync
with ``backend/app/ai/skin_model.py`` (the inference side). If you change the
heads here, change them there too.
"""
from __future__ import annotations

# Model output heads, in order. Matches app/ai/skin_model.py METRIC_ORDER.
METRIC_ORDER = (
    "hydration_score",
    "oiliness_score",
    "wrinkle_score",
    "pigmentation_score",
    "dark_circle_score",
    "pore_score",
    "elasticity_score",
    "muscle_tone_score",
    "inflammation_score",
)

INPUT_SIZE = 224
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

# Datasets label severity 0..5; we train/serve on a 0..100 scale.
SEVERITY_MAX = 5.0
SCORE_MAX = 100.0

# Default mapping: dataset label column -> our metric head.
# Edit this for your dataset's actual column names. Metrics with no mapped column
# are simply left unsupervised (masked out of the loss) — train them later from a
# dataset that does label them. "invert" flips a "good→bad" column if needed.
#
# Example below targets the Kaggle "Facial Skin Analysis & Type Classification"
# style columns. Acne is used as an inflammation proxy.
DEFAULT_COLUMN_MAP = {
    "excessive_oil":     {"metric": "oiliness_score"},
    "open_pores":        {"metric": "pore_score"},
    "wrinkles_forehead": {"metric": "wrinkle_score"},
    "pigmentation":      {"metric": "pigmentation_score"},
    "acne":              {"metric": "inflammation_score"},
    "dark_circles":      {"metric": "dark_circle_score"},
}


def severity_to_score(value: float, invert: bool = False) -> float:
    """Map a 0..SEVERITY_MAX label to a 0..SCORE_MAX target."""
    frac = max(0.0, min(1.0, float(value) / SEVERITY_MAX))
    if invert:
        frac = 1.0 - frac
    return frac * SCORE_MAX
