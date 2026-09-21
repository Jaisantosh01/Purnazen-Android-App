"""Golden-set regression: every analyzer change must show up as a diff here.

Runs the real face pipeline on the fixed images in ``tests/golden/`` and compares
each score to ``tests/golden/expected.json``. A failure is not necessarily a bug —
it means the numbers moved, and someone has to look at the diff and decide.

Regenerate after an *intentional* change:

    python -m pytest tests/test_golden_scans.py --golden-update

Expectations are keyed by detector path (``mediapipe`` / ``haar``) because the two
produce different ROIs; each venv only asserts against the path it can run.
Tongue images are not in the set yet — drop ``tongue_*.jpg`` in and regenerate.
"""
import glob
import json
import os
import types

import pytest

GOLDEN_DIR = os.path.join(os.path.dirname(__file__), "golden")
EXPECTED = os.path.join(GOLDEN_DIR, "expected.json")
TOLERANCE = 1.0   # points on the 0-100 scale

cv2 = pytest.importorskip("cv2")


def _detector_path() -> str:
    try:
        import mediapipe  # noqa: F401
        return "mediapipe"
    except ImportError:
        return "haar"


class _FakeDB:
    def commit(self): pass


def _score(path: str) -> dict:
    from app.ai.image_preprocessor import detect_blur, detect_lighting, resize_for_analysis
    from app.services.scan_pipeline_service import _run_face_pipeline

    img = resize_for_analysis(cv2.imread(path))
    scan = types.SimpleNamespace(
        id=0, user_id=0, landmarks_json=None, face_confidence=None,
        blur_score=detect_blur(img), lighting_quality=detect_lighting(img),
    )
    out = _run_face_pipeline(_FakeDB(), scan, img)
    return {k: round(float(v), 2) for k, v in out.items() if isinstance(v, (int, float))}


def _load_expected() -> dict:
    return json.load(open(EXPECTED)) if os.path.exists(EXPECTED) else {}


@pytest.fixture(scope="module")
def golden_images():
    files = sorted(glob.glob(os.path.join(GOLDEN_DIR, "*.jpg")))
    if not files:
        pytest.skip("no golden images")
    return files


def test_golden_scores(golden_images, request):
    path_key = _detector_path()
    expected = _load_expected()
    actual = {os.path.basename(f): _score(f) for f in golden_images}

    if request.config.getoption("--golden-update"):
        expected[path_key] = actual
        json.dump(expected, open(EXPECTED, "w"), indent=2, sort_keys=True)
        pytest.skip(f"golden expectations rewritten for '{path_key}'")

    if path_key not in expected:
        pytest.skip(f"no expectations recorded for '{path_key}' — run with --golden-update")

    drift = []
    for name, scores in actual.items():
        for metric, value in scores.items():
            want = expected[path_key].get(name, {}).get(metric)
            if want is None or abs(value - want) > TOLERANCE:
                drift.append(f"{name}:{metric} expected {want} got {value}")
    assert not drift, "scores moved (rerun with --golden-update if intentional):\n" + "\n".join(drift)
