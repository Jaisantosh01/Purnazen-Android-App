"""Cycle-1 foundation unit tests: recalibrated CV + skin-tone + model fallback.

These assert *ranking sanity* and *robustness*, not exact magic numbers — the
whole point of Cycle 1 is that scores stop being arbitrary.
"""
import numpy as np
import pytest

pytest.importorskip("cv2")
import cv2  # noqa: E402


def _skin_patch(h=120, w=120, bgr=(110, 150, 200), sigma=6):
    base = np.full((h, w, 3), bgr, np.uint8)
    noise = np.random.default_rng(0).normal(0, sigma, base.shape).astype(np.int16)
    return np.clip(base.astype(np.int16) + noise, 0, 255).astype(np.uint8)


# ── oiliness: the reported bug — oily skin must outscore matte skin ───────────

def test_oiliness_glossy_outscores_matte():
    from app.ai.analyzers import oiliness_analyzer

    matte = _skin_patch()
    glossy = matte.copy()
    # Add bright, desaturated specular highlights (sebum gloss).
    for cx, cy in [(30, 30), (70, 50), (50, 85), (90, 90)]:
        cv2.circle(glossy, (cx, cy), 9, (250, 250, 250), -1)
    glossy = cv2.GaussianBlur(glossy, (5, 5), 0)

    s_matte = oiliness_analyzer.analyze(matte)
    s_glossy = oiliness_analyzer.analyze(glossy)
    assert 0 <= s_matte <= 100 and 0 <= s_glossy <= 100
    assert s_glossy > s_matte + 10, f"glossy {s_glossy:.1f} should beat matte {s_matte:.1f}"
    assert oiliness_analyzer.analyze(None) == 30.0


# ── every metric must point the right way (not just oiliness) ────────────────

def _draw(base, fn):
    out = base.copy()
    fn(out)
    return out


def test_all_metrics_rank_correctly():
    """Wrinkle/pigmentation/pore/elasticity/dark-circle/hydration directionality."""
    from app.ai.analyzers import (
        hydration_analyzer, wrinkle_analyzer, pigmentation_analyzer,
        dark_circle_analyzer, pore_analyzer, elasticity_analyzer,
    )
    rng = np.random.default_rng(0)

    def skin(bgr=(115, 150, 195), sig=5):
        b = np.full((140, 140, 3), bgr, np.uint8)
        n = rng.normal(0, sig, b.shape).astype(np.int16)
        return np.clip(b.astype(np.int16) + n, 0, 255).astype(np.uint8)

    smooth = skin()
    wrinkled = _draw(smooth, lambda o: [cv2.line(o, (5, y), (135, y), (80, 105, 150), 1)
                                        for y in range(15, 140, 12)])
    pigmented = cv2.GaussianBlur(
        _draw(smooth, lambda o: [cv2.circle(o, c, 12, (70, 95, 150), -1)
                                 for c in [(40, 40), (90, 60), (60, 100)]]), (7, 7), 0)
    porey = _draw(smooth, lambda o: [cv2.circle(o, tuple(rng.integers(0, 140, 2)), 1, (85, 110, 160), -1)
                                     for _ in range(300)])
    cheek = skin(bgr=(120, 155, 200))
    ue_dark, ue_even = skin(bgr=(80, 95, 130)), skin(bgr=(118, 152, 198))

    assert wrinkle_analyzer.analyze(wrinkled, wrinkled) > wrinkle_analyzer.analyze(smooth, smooth)
    assert pigmentation_analyzer.analyze(pigmented, pigmented, pigmented) > \
        pigmentation_analyzer.analyze(smooth, smooth, smooth)
    assert pore_analyzer.analyze(porey, porey) > pore_analyzer.analyze(smooth, smooth)
    assert elasticity_analyzer.analyze(smooth, smooth) > elasticity_analyzer.analyze(wrinkled, wrinkled)
    assert dark_circle_analyzer.analyze(ue_dark, ue_dark, cheek, cheek) > \
        dark_circle_analyzer.analyze(ue_even, ue_even, cheek, cheek)
    assert hydration_analyzer.analyze(smooth, smooth) >= hydration_analyzer.analyze(wrinkled, wrinkled)


# ── white balance: a colour cast should be neutralised ───────────────────────

def test_white_balance_reduces_colour_cast():
    from app.ai.image_preprocessor import normalize_white_balance

    tinted = _skin_patch(bgr=(210, 150, 120))  # strong blue-ish cast
    before = tinted.reshape(-1, 3).mean(0)
    after = normalize_white_balance(tinted).reshape(-1, 3).mean(0)
    assert after.max() - after.min() < before.max() - before.min()


# ── exposure: same subject at different brightness converges after normalize ──

def _mean_l(img_bgr):
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2Lab)
    return float(np.mean(lab[:, :, 0]))


def test_exposure_normalization_converges_bright_and_dim():
    """A bright and a dim capture of the same face land at similar luminance —
    the fix for 'same face, different lighting → different score'."""
    from app.ai.image_preprocessor import normalize_exposure

    base = _skin_patch(bgr=(120, 150, 190))
    bright = np.clip(base.astype(np.int16) + 55, 0, 255).astype(np.uint8)
    dim = np.clip(base.astype(np.int16) - 55, 0, 255).astype(np.uint8)

    gap_before = abs(_mean_l(bright) - _mean_l(dim))
    gap_after = abs(_mean_l(normalize_exposure(bright)) - _mean_l(normalize_exposure(dim)))

    assert gap_after < gap_before
    # The residual gap should be a small fraction of the original swing.
    assert gap_after < gap_before * 0.5


def test_exposure_normalization_preserves_relative_contrast():
    """A single global gain must keep a dark region darker than a light one so
    contrast-based metrics (dark circles) survive normalization."""
    from app.ai.image_preprocessor import normalize_exposure

    img = np.full((80, 80, 3), (120, 150, 190), np.uint8)
    img[:40] = (60, 75, 110)  # top half noticeably darker
    out = normalize_exposure(img)
    top_l = _mean_l(out[:40])
    bottom_l = _mean_l(out[40:])
    assert top_l < bottom_l


# ── skin tone: ITA orders light vs dark, baseline_a stays bounded ────────────

def test_skin_tone_ita_orders_light_dark():
    from app.ai.image_preprocessor import estimate_skin_tone

    light = {"left_cheek": _skin_patch(bgr=(200, 210, 225)), "right_cheek": _skin_patch(bgr=(200, 210, 225))}
    dark = {"left_cheek": _skin_patch(bgr=(55, 70, 95)), "right_cheek": _skin_patch(bgr=(55, 70, 95))}
    t_light = estimate_skin_tone(light)
    t_dark = estimate_skin_tone(dark)
    assert t_light["ita"] > t_dark["ita"]
    assert 4.0 <= t_dark["baseline_a"] <= 20.0
    # No usable ROI → safe neutral default.
    assert estimate_skin_tone({})["bucket"] == "intermediate"


# ── inflammation: tone baseline lowers false redness on warmer skin ──────────

def test_inflammation_baseline_reduces_score():
    from app.ai.analyzers import inflammation_analyzer

    warm = _skin_patch(bgr=(90, 120, 190))  # reddish/warm skin
    s_no_baseline = inflammation_analyzer.analyze(warm, warm, warm, 0.0)
    s_with_baseline = inflammation_analyzer.analyze(warm, warm, warm, 12.0)
    assert s_with_baseline <= s_no_baseline


# ── confidence: complete+good beats sparse+poor ──────────────────────────────

def test_confidence_ranking():
    from app.services.scan_pipeline_service import _compute_confidence, _METRIC_KEYS

    full_rois = {z: _skin_patch() for z in (
        "left_cheek", "right_cheek", "t_zone", "forehead", "eye_corners_l",
        "under_eye_l", "under_eye_r", "jawline",
    )}
    good = _compute_confidence(_METRIC_KEYS, full_rois, 200.0, "good", landmarks=[1] * 478, scoring_method="model")
    poor = _compute_confidence(_METRIC_KEYS, {}, 35.0, "poor", landmarks=[], scoring_method="cv")
    assert good["overall"] > poor["overall"]
    assert 0.0 <= poor["overall"] <= 1.0 and 0.0 <= good["overall"] <= 1.0


# ── trained model is optional: absent file → CV fallback (None) ───────────────

def test_skin_model_absent_returns_none():
    import app.ai.skin_model as sm

    # Force a clean load attempt against a definitely-missing path.
    sm._model = None
    sm._load_attempted = False
    orig = sm.MODEL_PATH
    try:
        from pathlib import Path
        sm.MODEL_PATH = Path("definitely") / "not" / "here.onnx"
        assert sm.get_skin_model() is None
    finally:
        sm.MODEL_PATH = orig
        sm._model = None
        sm._load_attempted = False
