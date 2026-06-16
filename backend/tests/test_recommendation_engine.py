"""Tests for the TCM recommendation engine (single + combination/pattern rules)."""
from types import SimpleNamespace

from app.services import recommendation_engine_service as engine

# Neutral-ish baseline that triggers no rules; override per test.
BASE = dict(
    hydration_score=70, oiliness_score=30, wrinkle_score=20, pigmentation_score=25,
    dark_circle_score=30, pore_score=30, elasticity_score=70, muscle_tone_score=70,
    inflammation_score=15, glow_score=75, toxin_indicator=20,
    overall_wellness_score=75,
)


def _gen(**overrides):
    return engine.generate(SimpleNamespace(**{**BASE, **overrides}))


def _titles(recs):
    return [r["title"] for r in recs]


def test_capped_at_max_and_sorted_by_priority():
    # Drive almost everything into a bad state → many rules fire.
    recs = _gen(
        hydration_score=20, oiliness_score=80, wrinkle_score=80, pigmentation_score=80,
        dark_circle_score=80, pore_score=80, elasticity_score=20, muscle_tone_score=20,
        inflammation_score=80, glow_score=20, toxin_indicator=80, overall_wellness_score=20,
    )
    assert len(recs) <= 8
    priorities = [r["priority"] for r in recs]
    assert priorities == sorted(priorities)


def test_combination_dehydrated_oily():
    recs = _gen(hydration_score=35, oiliness_score=70)
    assert "Balance Combination Skin" in _titles(recs)


def test_combination_congested():
    recs = _gen(oiliness_score=70, pore_score=65, inflammation_score=60)
    assert "Clarify Congested Skin" in _titles(recs)


def test_combination_fatigue():
    recs = _gen(dark_circle_score=70, glow_score=45)
    assert "Restore Radiance" in _titles(recs)


def test_combination_ageing():
    recs = _gen(wrinkle_score=65, elasticity_score=40)
    assert "Firm & Renew" in _titles(recs)


def test_combination_pip():
    recs = _gen(inflammation_score=65, pigmentation_score=65)
    assert "Calm, Then Even Tone" in _titles(recs)


def test_combinations_outrank_singles():
    # Dehydrated-oily combo (priority 0) should appear before single-metric tips.
    recs = _gen(hydration_score=35, oiliness_score=75)
    assert recs[0]["title"] == "Balance Combination Skin"


def test_healthy_profile_celebrates():
    recs = _gen()  # all good
    assert "Excellent Skin Vitality" in _titles(recs)


def test_each_rec_has_required_keys():
    recs = _gen(hydration_score=30, oiliness_score=70)
    for r in recs:
        assert set(r) >= {"recommendation_type", "priority", "title", "description", "routine_key", "tip_category"}
