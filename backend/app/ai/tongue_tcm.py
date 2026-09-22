"""TCM tongue-finding classifier — YOLOv8 fine-tuned on TCM-Tongue.

Trained by ``backend/ml/tongue/train_tongue_yolo.py`` (Kaggle GPU kernel) on the
TCM-Tongue dataset (arXiv:2507.18288): 21 practitioner-verified findings, each
annotated as a box over the tongue. Weights are dropped at ``MODEL_PATH``; when
absent, ``classify()`` returns None and the tongue pipeline keeps its classical
Lab/HSV thresholds — the same drop-in contract as ``skin_model.py``.

Output is a dict of ``english_name → confidence`` for every finding the model
saw at or above ``_MIN_CONF``. The tongue pipeline turns that into the three
heads the app shows (cracks, tooth marks, slippery/greasy coat) and, when the
model is confident, overrides the threshold-based body/coat/shape categories.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "models" / "tongue_tcm_yolov8n.pt"
_MIN_CONF = 0.30

# Keep in sync with backend/ml/tongue/train_tongue_yolo.py::ENGLISH.
ENGLISH = {
    "jiankangshe": "healthy",          "botaishe":   "thin_coat",
    "hongshe":     "red_body",         "zishe":      "purple_body",
    "pangdashe":   "swollen_body",     "shoushe":    "thin_body",
    "hongdianshe": "red_dots",         "liewenshe":  "cracks",
    "chihenshe":   "tooth_marks",      "baitaishe":  "white_coat",
    "huangtaishe": "yellow_coat",      "heitaishe":  "black_coat",
    "huataishe":   "slippery_coat",
    "shenquao":    "kidney_zone_concave",  "shenqutu":  "kidney_zone_convex",
    "gandanao":    "liver_gb_zone_concave", "gandantu": "liver_gb_zone_convex",
    "piweiao":     "spleen_zone_concave",  "piweitu":   "spleen_zone_convex",
    "xinfeiao":    "heartlung_zone_concave", "xinfeitu": "heartlung_zone_convex",
}

_model = None
_load_attempted = False


def get_tcm_model():
    """Lazily load the fine-tuned YOLO. Returns None if weights/ultralytics are absent."""
    global _model, _load_attempted
    if _model is not None:
        return _model
    if _load_attempted:
        return None
    _load_attempted = True
    if not MODEL_PATH.exists():
        logger.info("No TCM tongue model at %s — tongue findings use CV thresholds.", MODEL_PATH)
        return None
    try:
        from ultralytics import YOLO  # type: ignore
        _model = YOLO(str(MODEL_PATH))
        logger.info("Loaded TCM tongue model from %s", MODEL_PATH)
        return _model
    except Exception as exc:
        logger.warning("Failed to load TCM tongue model (%s) — using CV thresholds.", exc)
        return None


def classify(img_bgr: np.ndarray) -> dict | None:
    """Return ``{english_finding: max_confidence}`` or None when no model."""
    model = get_tcm_model()
    if model is None or img_bgr is None or img_bgr.size == 0:
        return None
    try:
        results = model.predict(source=img_bgr, conf=_MIN_CONF, imgsz=640, verbose=False)
    except Exception as exc:
        logger.warning("TCM tongue inference failed (%s)", exc)
        return None
    if not results:
        return {}
    boxes = getattr(results[0], "boxes", None)
    if boxes is None or len(boxes) == 0:
        return {}
    names = results[0].names
    out: dict[str, float] = {}
    for cls_i, conf in zip(boxes.cls.tolist(), boxes.conf.tolist()):
        pinyin = names[int(cls_i)]
        key = ENGLISH.get(pinyin, pinyin)
        out[key] = max(out.get(key, 0.0), float(conf))
    return out
