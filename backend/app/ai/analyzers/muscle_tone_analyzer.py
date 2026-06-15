"""Muscle tone analyzer — estimates facial symmetry from landmark bilateral pairs.

Score 0-100 where 100 = excellent symmetry/muscle tone.
"""
import numpy as np

# Landmark pairs (left_idx, right_idx) that should be bilaterally symmetric
_SYMMETRY_PAIRS: list[tuple[int, int]] = [
    # Cheek points
    (116, 345),
    (123, 352),
    (187, 411),
    # Eye corners
    (33, 263),
    (133, 362),
    # Jaw
    (172, 397),
    (136, 365),
    (150, 379),
    # Temples
    (54, 284),
    (103, 332),
]

# Nose tip landmark index (used as face centre)
_NOSE_TIP = 1


def analyze(landmarks: list, img_h: int, img_w: int) -> float:
    """Return muscle tone / facial symmetry score 0-100.

    Returns 70.0 if the landmarks list is empty or too short.
    """
    if not landmarks or len(landmarks) <= max(idx for pair in _SYMMETRY_PAIRS for idx in pair):
        return 70.0

    center_x = float(landmarks[_NOSE_TIP].x)

    symmetry_values: list[float] = []
    for l_idx, r_idx in _SYMMETRY_PAIRS:
        if l_idx >= len(landmarks) or r_idx >= len(landmarks):
            continue

        dist_l = abs(float(landmarks[l_idx].x) - center_x)
        dist_r = abs(float(landmarks[r_idx].x) - center_x)

        denom = dist_l + dist_r
        if denom < 1e-6:
            continue

        sym = 1.0 - abs(dist_l - dist_r) / denom
        symmetry_values.append(sym)

    if not symmetry_values:
        return 70.0

    mean_symmetry = float(np.mean(symmetry_values))
    return float(np.clip(mean_symmetry * 100.0, 0.0, 100.0))
