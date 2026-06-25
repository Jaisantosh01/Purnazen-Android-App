"""MediaPipe FaceLandmarker singleton for Sprint 3 face analysis pipeline."""
import logging
import os
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/latest/face_landmarker.task"
)
_MODEL_PATH = Path(__file__).parent / "face_landmarker.task"

_mediapipe_available = False
_mp = None
_mp_tasks = None

try:
    import mediapipe as mp  # type: ignore
    _mp = mp
    _mp_tasks = mp.tasks
    _mediapipe_available = True
except ImportError:
    pass

_detector = None


def _download_model() -> None:
    """Download the MediaPipe face_landmarker.task model if not already present."""
    if _MODEL_PATH.exists():
        logger.info("MediaPipe face_landmarker.task already present at %s", _MODEL_PATH)
        return

    logger.info("Downloading MediaPipe face_landmarker.task from %s ...", _MODEL_URL)
    import urllib.request
    urllib.request.urlretrieve(_MODEL_URL, str(_MODEL_PATH))
    logger.info("Downloaded face_landmarker.task to %s (%d bytes)", _MODEL_PATH, _MODEL_PATH.stat().st_size)


class FaceDetector:
    """Wraps MediaPipe FaceLandmarker in IMAGE mode."""

    def __init__(self) -> None:
        if not _mediapipe_available:
            raise RuntimeError(
                "AI packages not installed. Install mediapipe and related dependencies."
            )

        _download_model()

        mp = _mp
        BaseOptions = mp.tasks.BaseOptions
        FaceLandmarker = mp.tasks.vision.FaceLandmarker
        FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
        VisionRunningMode = mp.tasks.vision.RunningMode

        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(_MODEL_PATH)),
            running_mode=VisionRunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.5,
        )
        self._landmarker = FaceLandmarker.create_from_options(options)
        logger.info("MediaPipe FaceLandmarker initialised.")

    def detect(self, image_bgr: np.ndarray) -> tuple[list, float]:
        """Run face landmark detection on a BGR image.

        Returns (landmarks_list, confidence) where landmarks_list is
        result.face_landmarks[0] (list[NormalizedLandmark]) or [] if no face.
        """
        if not _mediapipe_available:
            raise RuntimeError(
                "AI packages not installed. Install mediapipe and related dependencies."
            )

        mp = _mp
        # Convert BGR -> RGB for MediaPipe
        image_rgb = image_bgr[:, :, ::-1].copy()
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=image_rgb,
        )
        result = self._landmarker.detect(mp_image)

        if result.face_landmarks and len(result.face_landmarks) > 0:
            return result.face_landmarks[0], 0.95
        return [], 0.0

    def close(self) -> None:
        """Release MediaPipe resources."""
        try:
            self._landmarker.close()
        except Exception:
            pass


def get_face_detector() -> FaceDetector:
    """Lazily create and return the module-level FaceDetector singleton."""
    global _detector

    if not _mediapipe_available:
        raise RuntimeError(
            "AI packages not installed. Install mediapipe and related dependencies "
            "before using the face analysis pipeline."
        )

    if _detector is None:
        _detector = FaceDetector()
    return _detector
