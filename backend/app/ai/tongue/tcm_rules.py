"""Tongue TCM rules → overall wellness score.

The *recommendation* rules for tongue patterns already live in
recommendation_engine_service (yellow coat → Damp-heat, dry → Yin deficiency,
pale/dark-red body, etc.). Here we only fold the markers into a single 0-100
wellness score so the dashboard/results have a headline number.

The score is computed from the *continuous* raw measurements (Lab a*, coat
fraction, gloss ratio, aspect) wherever they're available, so a small real change
in the tongue moves the number a little rather than by 0 or 16 points at once.
The categorical penalty table remains the fallback for low-signal results.
"""

# Penalty (points off a 90 baseline) for each non-ideal marker — the ceiling of
# each continuous ramp below, and the whole story when raw metrics are missing.
_PENALTY = {
    "body_color": {"pale": 16, "red": 12, "dark_red": 18, "purple": 18},
    "coat_color": {"yellow": 14},
    "coat_thick": {"moderate": 6, "thick": 14},
    "moisture":   {"dry": 12},
    "shape":      {"swollen": 8, "thin": 8},
}

# Bands mirror color_analyzer's thresholds: inside = 0 penalty, ramps outside.
_A_NORMAL = (6.0, 18.0)       # Lab a* − 128 of the tongue body
_A_RAMP = 8.0                 # a* units from band edge to full penalty
_L_DARK, _L_RAMP = 110.0, 30.0
_COAT_THIN, _COAT_THICK = 0.12, 0.45
_GLOSS_MOIST = 0.04
_ASPECT_NORMAL = (0.55, 0.95)
_ASPECT_RAMP = 0.20


def _ramp(x: float, span: float) -> float:
    """0 at x ≤ 0, 1 at x ≥ span, linear between."""
    return max(0.0, min(1.0, x / span))


def _continuous_penalty(raw: dict, markers: dict) -> float:
    a_rel = float(raw["a_body"]) - 128.0
    l_body = float(raw["l_body"])
    penalty = 0.0

    # Body colour — pale below the band, red above it, darker red heavier.
    lo, hi = _A_NORMAL
    if a_rel < lo:
        penalty += 16.0 * _ramp(lo - a_rel, lo)
    elif a_rel > hi:
        penalty += 12.0 * _ramp(a_rel - hi, _A_RAMP)
        penalty += 6.0 * _ramp(_L_DARK - l_body, _L_RAMP)

    # Coat colour has no continuous raw metric — keep the categorical rule.
    penalty += _PENALTY["coat_color"].get(markers.get("coat_color"), 0)

    # Coat thickness from coverage; moisture from specular gloss.
    penalty += 14.0 * _ramp(float(raw["coat_frac"]) - _COAT_THIN, _COAT_THICK - _COAT_THIN)
    penalty += 12.0 * _ramp(_GLOSS_MOIST - float(raw["gloss"]), _GLOSS_MOIST)

    # Shape: distance outside the normal aspect band.
    lo, hi = _ASPECT_NORMAL
    aspect = float(raw["aspect"])
    penalty += 8.0 * _ramp(max(lo - aspect, aspect - hi), _ASPECT_RAMP)
    return penalty


def overall_wellness(markers: dict) -> float:
    raw = markers.get("raw") or {}
    if all(k in raw for k in ("a_body", "l_body", "coat_frac", "gloss", "aspect")):
        penalty = _continuous_penalty(raw, markers)
    else:
        penalty = sum(table.get(markers.get(dim), 0) for dim, table in _PENALTY.items())
    return round(max(20.0, min(95.0, 90.0 - penalty)), 2)
