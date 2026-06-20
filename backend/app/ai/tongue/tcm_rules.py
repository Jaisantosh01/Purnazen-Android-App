"""Tongue TCM rules → overall wellness score.

The *recommendation* rules for tongue patterns already live in
recommendation_engine_service (yellow coat → Damp-heat, dry → Yin deficiency,
pale/dark-red body, etc.). Here we only fold the markers into a single 0-100
wellness score so the dashboard/results have a headline number.
"""

# Penalty (points off a 90 baseline) for each non-ideal marker.
_PENALTY = {
    "body_color": {"pale": 16, "red": 12, "dark_red": 18, "purple": 18},
    "coat_color": {"yellow": 14},
    "coat_thick": {"moderate": 6, "thick": 14},
    "moisture":   {"dry": 12},
    "shape":      {"swollen": 8, "thin": 8},
}


def overall_wellness(markers: dict) -> float:
    score = 90.0
    for dim, table in _PENALTY.items():
        score -= table.get(markers.get(dim), 0)
    return round(max(20.0, min(95.0, score)), 2)
