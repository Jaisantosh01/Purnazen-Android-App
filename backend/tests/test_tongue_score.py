"""The tongue wellness score must move smoothly with the measurements (D-3)."""
from app.ai.tongue.tcm_rules import overall_wellness


def _markers(**raw):
    base = {"a_body": 140.0, "l_body": 150.0, "coat_frac": 0.05, "gloss": 0.08, "aspect": 0.75}
    base.update(raw)
    return {"body_color": "normal", "coat_color": "white", "coat_thick": "thin",
            "moisture": "moist", "shape": "normal", "raw": base}


def test_healthy_tongue_scores_the_baseline():
    assert overall_wellness(_markers()) == 90.0


def test_paleness_is_a_ramp_not_a_cliff():
    # Sweep a* from normal (140) down to very pale (128): every 1-unit step
    # should cost at most ~3 points, and the sequence must be non-increasing.
    scores = [overall_wellness(_markers(a_body=a)) for a in range(140, 127, -1)]
    assert scores == sorted(scores, reverse=True)
    steps = [a - b for a, b in zip(scores, scores[1:])]
    assert max(steps) <= 3.0
    assert scores[-1] == 90.0 - 16.0          # full "pale" penalty at the floor


def test_dark_red_is_heavier_than_red():
    red = overall_wellness(_markers(a_body=156.0, l_body=150.0))
    dark_red = overall_wellness(_markers(a_body=156.0, l_body=80.0))
    assert dark_red < red


def test_categorical_fallback_when_raw_is_missing():
    m = _markers(); m["raw"] = {"low_signal": True}
    m.update(body_color="pale", coat_color="yellow")
    assert overall_wellness(m) == 90.0 - 16 - 14
