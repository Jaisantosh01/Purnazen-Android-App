"""
Sandbox: unit tests for each CV analyzer using synthetic ROI patches.

Run from the backend/ directory:
    cd backend
    python sandbox/test_analyzers.py          # all analyzers
    python sandbox/test_analyzers.py hydration # single analyzer
"""
import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
logging.basicConfig(level=logging.WARNING)

import numpy as np
import cv2


# ── Synthetic patch factories ──────────────────────────────────────────────────

def _solid(h, w, bgr):
    return np.full((h, w, 3), bgr, dtype=np.uint8)

def _noisy(h, w, bgr, sigma=12):
    base = _solid(h, w, bgr)
    noise = np.random.normal(0, sigma, base.shape).astype(np.int16)
    return np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)

def _dark_patch(h=40, w=40):   return _noisy(h, w, (60, 80, 100))
def _light_patch(h=40, w=40):  return _noisy(h, w, (160, 180, 200))
def _oily_patch(h=40, w=40):   return _noisy(h, w, (80, 100, 120), sigma=4)
def _face_img(h=480, w=360):
    img = _solid(h, w, (100, 140, 190))
    cv2.ellipse(img, (w//2, h//2), (w//3, h//2 - 20), 0, 0, 360, (110, 155, 210), -1)
    return img


# ── Individual analyzer tests ──────────────────────────────────────────────────

def test_hydration():
    from app.ai.analyzers import hydration_analyzer
    s1 = hydration_analyzer.analyze(_light_patch(), _light_patch())
    s2 = hydration_analyzer.analyze(_dark_patch(), _dark_patch())
    assert 0 <= s1 <= 100 and 0 <= s2 <= 100
    assert s1 >= s2, f"light patch should score higher: {s1:.1f} vs {s2:.1f}"
    assert hydration_analyzer.analyze(None, None) == 50.0
    return s1, s2


def test_oiliness():
    from app.ai.analyzers import oiliness_analyzer
    s = oiliness_analyzer.analyze(_oily_patch())
    assert 0 <= s <= 100
    assert oiliness_analyzer.analyze(None) == 30.0  # default for None
    return s,


def test_wrinkle():
    from app.ai.analyzers import wrinkle_analyzer
    smooth = _noisy(40, 40, (140, 160, 180), sigma=2)
    rough  = _noisy(40, 40, (140, 160, 180), sigma=30)
    s_smooth = wrinkle_analyzer.analyze(smooth, smooth)
    s_rough  = wrinkle_analyzer.analyze(rough,  rough)
    assert 0 <= s_smooth <= 100 and 0 <= s_rough <= 100
    return s_smooth, s_rough


def test_pigmentation():
    from app.ai.analyzers import pigmentation_analyzer
    face = _face_img()
    s = pigmentation_analyzer.analyze(face, _light_patch(), _light_patch())
    assert 0 <= s <= 100
    return s,


def test_dark_circle():
    from app.ai.analyzers import dark_circle_analyzer
    s = dark_circle_analyzer.analyze(
        _dark_patch(), _dark_patch(), _light_patch(), _light_patch()
    )
    assert 0 <= s <= 100
    assert dark_circle_analyzer.analyze(None, None, None, None) == 30.0  # default for None
    return s,


def test_pore():
    from app.ai.analyzers import pore_analyzer
    s = pore_analyzer.analyze(_light_patch(), _light_patch())
    assert 0 <= s <= 100
    return s,


def test_elasticity():
    from app.ai.analyzers import elasticity_analyzer
    s = elasticity_analyzer.analyze(_light_patch(), _light_patch())
    assert 0 <= s <= 100
    return s,


def test_muscle_tone():
    from app.ai.analyzers import muscle_tone_analyzer
    # No landmarks = stub value
    s_no_lm = muscle_tone_analyzer.analyze([], 480, 360)
    assert 0 <= s_no_lm <= 100
    return s_no_lm,


def test_inflammation():
    from app.ai.analyzers import inflammation_analyzer
    # Reddish patch = high inflammation
    red_patch = _noisy(40, 40, (80, 80, 200))
    s_red  = inflammation_analyzer.analyze(red_patch, red_patch, red_patch)
    s_calm = inflammation_analyzer.analyze(_light_patch(), _light_patch(), _light_patch())
    assert 0 <= s_red <= 100 and 0 <= s_calm <= 100
    return s_red, s_calm


def test_glow_score_engine():
    from app.ai.analyzers import glow_score_engine
    perfect = {
        "hydration_score": 100, "oiliness_score": 0, "wrinkle_score": 0,
        "pigmentation_score": 0, "dark_circle_score": 0, "pore_score": 0,
        "elasticity_score": 100, "muscle_tone_score": 100, "inflammation_score": 0,
    }
    worst = {k: (0 if "elasticity" in k or "hydration" in k or "muscle" in k else 100)
             for k in perfect}
    s_perfect = glow_score_engine.compute(perfect)
    s_worst   = glow_score_engine.compute(worst)
    assert s_perfect == 100.0, f"Expected 100, got {s_perfect}"
    assert s_worst   ==   0.0, f"Expected 0, got {s_worst}"
    return s_perfect, s_worst


def test_toxin_indicator():
    from app.ai.analyzers import toxin_indicator
    # positional: compute(dark_circle_score, oiliness_score, glow_score)
    high = toxin_indicator.compute(80, 80, 20)
    low  = toxin_indicator.compute(10, 10, 90)
    assert 0 <= high <= 100 and 0 <= low <= 100
    assert high > low
    return high, low


# ── Runner ─────────────────────────────────────────────────────────────────────

TESTS = {
    "hydration":       test_hydration,
    "oiliness":        test_oiliness,
    "wrinkle":         test_wrinkle,
    "pigmentation":    test_pigmentation,
    "dark_circle":     test_dark_circle,
    "pore":            test_pore,
    "elasticity":      test_elasticity,
    "muscle_tone":     test_muscle_tone,
    "inflammation":    test_inflammation,
    "glow_score":      test_glow_score_engine,
    "toxin_indicator": test_toxin_indicator,
}

if __name__ == "__main__":
    target = sys.argv[1].lower() if len(sys.argv) > 1 else None
    tests = {k: v for k, v in TESTS.items() if not target or k.startswith(target)}
    if not tests:
        print(f"No test matched '{target}'. Available: {', '.join(TESTS)}")
        sys.exit(1)

    passed = failed = 0
    print(f"\nRunning {len(tests)} analyzer test(s)...\n")
    for name, fn in tests.items():
        try:
            result = fn()
            vals = "  ".join(f"{v:.1f}" for v in result)
            print(f"  [PASS]  {name:<20} [{vals}]")
            passed += 1
        except Exception as exc:
            print(f"  [FAIL]  {name:<20} {exc}")
            failed += 1

    print(f"\n{'='*42}")
    print(f"  {passed} passed  /  {failed} failed")
    if failed:
        sys.exit(1)
