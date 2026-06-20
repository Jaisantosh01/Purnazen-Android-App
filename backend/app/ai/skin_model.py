"""Trained skin-analysis model (ONNX Runtime) — the validated scorer.

This is the inference half of the ML pipeline. The training half lives in
``backend/ml/`` (run by the user on a GPU/Colab against a labeled dataset). Once
trained and exported, the model file is dropped at ``MODEL_PATH`` and this module
serves it; until then ``get_skin_model()`` returns ``None`` and the pipeline
falls back to the recalibrated classical-CV analyzers.

Contract shared with ``backend/ml/`` (keep in sync):
  - Input  : 1×3×224×224 float32, RGB, aligned face crop, ImageNet-normalized.
  - Output : 1×9 float32 in [0, 1] (sigmoid), in METRIC_ORDER, scaled ×100 here.
"""
import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# Output head order — MUST match backend/ml/train.py.
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

MODEL_PATH = Path(__file__).parent / "models" / "skin_model.onnx"
INPUT_SIZE = 224
_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

_model = None          # cached SkinModel instance
_load_attempted = False  # so we don't retry a missing model every scan


def _face_crop(img_bgr, landmarks):
    """Tight, padded crop around the face from landmarks; else centred crop."""
    h, w = img_bgr.shape[:2]
    if landmarks:
        xs = [lm.x for lm in landmarks]
        ys = [lm.y for lm in landmarks]
        x1 = max(0, int((min(xs) - 0.06) * w)); x2 = min(w, int((max(xs) + 0.06) * w))
        y1 = max(0, int((min(ys) - 0.08) * h)); y2 = min(h, int((max(ys) + 0.06) * h))
        if x2 - x1 >= 20 and y2 - y1 >= 20:
            return img_bgr[y1:y2, x1:x2]
    bw, bh = int(w * 0.62), int(h * 0.64)
    x = (w - bw) // 2
    y = int(h * 0.16)
    return img_bgr[y:y + bh, x:x + bw]


class SkinModel:
    """Wraps an ONNX Runtime session for multi-metric skin scoring."""

    def __init__(self, session):
        self._session = session
        self._input_name = session.get_inputs()[0].name

    def _preprocess(self, img_bgr, landmarks):
        import cv2
        crop = _face_crop(img_bgr, landmarks)
        crop = cv2.resize(crop, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        rgb = (rgb - _IMAGENET_MEAN) / _IMAGENET_STD
        chw = np.transpose(rgb, (2, 0, 1))[np.newaxis, ...]  # 1×3×H×W
        return chw.astype(np.float32)

    def predict(self, img_bgr, rois=None, landmarks=None):
        """Return {metric_score: 0-100} or None on failure."""
        x = self._preprocess(img_bgr, landmarks or [])
        out = self._session.run(None, {self._input_name: x})[0]
        vals = np.asarray(out).reshape(-1)
        if vals.shape[0] != len(METRIC_ORDER):
            logger.warning("Skin model output size %d != %d", vals.shape[0], len(METRIC_ORDER))
            return None
        return {k: float(np.clip(v, 0.0, 1.0)) * 100.0 for k, v in zip(METRIC_ORDER, vals)}


def get_skin_model():
    """Lazily load and cache the ONNX model. Returns None if unavailable."""
    global _model, _load_attempted
    if _model is not None:
        return _model
    if _load_attempted:
        return None
    _load_attempted = True

    if not MODEL_PATH.exists():
        logger.info("No trained skin model at %s — using CV analyzers.", MODEL_PATH)
        return None
    try:
        import onnxruntime as ort
    except ImportError:
        logger.info("onnxruntime not installed — using CV analyzers.")
        return None

    try:
        session = ort.InferenceSession(str(MODEL_PATH), providers=["CPUExecutionProvider"])
        _model = SkinModel(session)
        logger.info("Loaded skin model from %s", MODEL_PATH)
        return _model
    except Exception as exc:
        logger.warning("Failed to load skin model (%s) — using CV analyzers.", exc)
        return None
