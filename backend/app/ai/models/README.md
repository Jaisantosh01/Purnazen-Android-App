# Trained model drop-in directory

## Face / skin

Place the trained, exported skin-analysis model here as:

```
skin_model.onnx
```

It is produced by the training project in [`backend/ml/`](../../../ml/README.md)
(`python export_onnx.py`). The file is **git-ignored** (it's large and a build
artifact) — each environment supplies its own.

When this file is present, `app/ai/skin_model.py` loads it and it becomes the
scorer for face scans. When it's absent, the pipeline falls back to the
recalibrated classical-CV analyzers automatically — so the app works either way.

**Contract** (must match `backend/ml/train.py` and `app/ai/skin_model.py`):
- Input  `1×3×224×224` float32, RGB, aligned face crop, ImageNet-normalized.
- Output `1×9` float32 in `[0, 1]`, in `METRIC_ORDER`.

## Tongue

Tongue localization uses the open-source **TongueDiagnosis YOLOv5** weights
(same role as MediaPipe FaceLandmarker for faces):

- Source: https://github.com/TonguePicture-SKaRD/TongueDiagnosis
- Auto-downloaded on first use to `tongue_yolo.pt` by `app/ai/tongue_detector.py`
- Requires `ultralytics` (see `backend/requirements.txt`)

Optional future drop-ins (Coming soon in the app UI):

| File | Role |
|------|------|
| `tongue_color.pth` | Body colour classifier |
| `tongue_coat_color.pth` | Coat colour |
| `thickness.pth` | Coat thickness |
| `rot_and_greasy.pth` | Greasiness / rot |

Those classification heads ship in the same TongueDiagnosis release; wire them
when ready and keep the CV colour heuristics as fallback.
