"""TCM model findings → app heads and category overrides (model mocked)."""
import numpy as np

from app.ai.tongue import apply_tcm_findings, tcm_heads


def test_heads_are_none_without_model():
    assert tcm_heads(None) == {"tongue_greasiness": None, "tongue_cracks": None, "tongue_tooth_marks": None}


def test_heads_present_absent_by_confidence():
    h = tcm_heads({"cracks": 0.8, "tooth_marks": 0.2})
    assert h == {"tongue_greasiness": "absent", "tongue_cracks": "present", "tongue_tooth_marks": "absent"}


def test_confident_findings_override_categories_but_weak_ones_do_not():
    cv = {"body_color": "normal", "coat_color": "white", "coat_thick": "moderate", "moisture": "moist", "shape": "normal"}
    out = apply_tcm_findings(cv, {"purple_body": 0.9, "yellow_coat": 0.4, "swollen_body": 0.55})
    assert out["body_color"] == "purple"
    assert out["coat_color"] == "white"        # 0.4 < override threshold
    assert out["shape"] == "swollen"
    assert out["coat_thick"] == "moderate"


def test_analyze_uses_model_when_present(monkeypatch):
    """End-to-end through analyze(): mocked classifier → heads + raw_metrics."""
    import app.ai.tongue as tongue
    import app.ai.tongue_tcm as tcm

    monkeypatch.setattr(tcm, "classify", lambda img: {"cracks": 0.7, "red_body": 0.8})
    monkeypatch.setattr(tongue, "is_tongue_present", lambda img, **kw: True)
    img = np.full((240, 320, 3), (120, 110, 200), np.uint8)   # pinkish block
    out = tongue.analyze(img)
    assert out["tongue_cracks"] == "present"
    assert out["tongue_body_color"] == "red"
    assert out["raw_metrics"]["tongue_cracks"] == "present"
    assert out["raw_metrics"]["tcm_findings"]["cracks"] == 0.7
