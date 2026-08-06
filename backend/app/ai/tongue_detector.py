"""Tongue localizer — the tongue equivalent of ``face_detector.py``.

Primary path: a trained YOLOv5 tongue detector from the open-source
TongueDiagnosis project (YOLOv5 localization → SAM/UNet segmentation lineage):
  https://github.com/TonguePicture-SKaRD/TongueDiagnosis

Weights auto-download on first use into ``app/ai/models/tongue_yolo.pt``,
mirroring how MediaPipe ``face_landmarker.task`` is fetched.

Inference prefers Ultralytics when installed; otherwise the classical-CV
fallback in ``app.ai.tongue`` keeps scans working. Classification heads
(coat greasiness, cracks, …) can be layered on later as "coming soon".
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

_MODEL_URL = (
    "https://github.com/TonguePicture-SKaRD/TongueDiagnosis/releases/"
    "download/V1.0_Beta/yolov5.pt"
)
_MODEL_PATH = Path(__file__).parent / "models" / "tongue_yolo.pt"
_MIN_CONF = 0.45

_detector = None
_load_attempted = False


def _download_model() -> bool:
    """Fetch the TongueDiagnosis YOLOv5 tongue weights if missing."""
    if _MODEL_PATH.exists() and _MODEL_PATH.stat().st_size > 1_000_000:
        return True
    _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    logger.info("Downloading tongue YOLO weights from %s …", _MODEL_URL)
    try:
        import urllib.request

        tmp = _MODEL_PATH.with_suffix(".pt.part")
        urllib.request.urlretrieve(_MODEL_URL, str(tmp))
        tmp.replace(_MODEL_PATH)
        logger.info(
            "Downloaded tongue_yolo.pt (%d bytes)",
            _MODEL_PATH.stat().st_size,
        )
        return True
    except Exception as exc:
        logger.warning("Could not download tongue YOLO weights (%s)", exc)
        if _MODEL_PATH.with_suffix(".pt.part").exists():
            try:
                _MODEL_PATH.with_suffix(".pt.part").unlink()
            except OSError:
                pass
        return False


class TongueDetector:
    """Wraps Ultralytics YOLO for tongue bounding-box detection."""

    def __init__(self, model):
        self._model = model

    def detect(self, img_bgr: np.ndarray) -> dict | None:
        """Return ``{bbox, confidence, source}`` or None.

        ``bbox`` is pixel ``(x, y, w, h)`` on the input image.
        """
        if img_bgr is None or img_bgr.size == 0:
            return None
        try:
            # Ultralytics accepts BGR numpy arrays.
            results = self._model.predict(
                source=img_bgr,
                conf=_MIN_CONF,
                verbose=False,
                imgsz=640,
            )
        except Exception as exc:
            logger.warning("Tongue YOLO inference failed (%s)", exc)
            return None

        if not results:
            return None
        boxes = getattr(results[0], "boxes", None)
        if boxes is None or len(boxes) == 0:
            return None

        # Take the highest-confidence detection.
        best_i = int(boxes.conf.argmax().item())
        conf = float(boxes.conf[best_i].item())
        if conf < _MIN_CONF:
            return None
        xyxy = boxes.xyxy[best_i].tolist()
        x1, y1, x2, y2 = [int(round(v)) for v in xyxy]
        w = max(1, x2 - x1)
        h = max(1, y2 - y1)
        return {
            "bbox": (x1, y1, w, h),
            "confidence": conf,
            "source": "yolo",
        }


def get_tongue_detector() -> TongueDetector | None:
    """Lazily load the YOLO tongue detector. Returns None if unavailable."""
    global _detector, _load_attempted
    if _detector is not None:
        return _detector
    if _load_attempted:
        return None
    _load_attempted = True

    try:
        from ultralytics import YOLO  # type: ignore
    except ImportError:
        logger.info(
            "ultralytics not installed — tongue scans use classical-CV detection. "
            "Install ultralytics to enable the TongueDiagnosis YOLO model."
        )
        return None

    if not _download_model():
        return None

    try:
        model = YOLO(str(_MODEL_PATH))
        _detector = TongueDetector(model)
        logger.info("Loaded tongue YOLO detector from %s", _MODEL_PATH)
        return _detector
    except Exception as exc:
        logger.warning("Failed to load tongue YOLO (%s) — using CV fallback.", exc)
        return None


def detect_tongue(img_bgr: np.ndarray) -> dict | None:
    """Convenience: run the singleton detector, or None if no model/hit."""
    det = get_tongue_detector()
    if det is None:
        return None
    return det.detect(img_bgr)
