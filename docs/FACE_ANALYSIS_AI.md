# Face Analysis AI Pipeline — Libraries, Models & Techniques

**Last updated:** 2026-06-15
**Scope:** the server-side computer-vision pipeline that turns an uploaded face
selfie into skin metrics, a glow score, and TCM-based wellness recommendations.

> Companion docs: design spec **[FACE_ANALYSIS_SPEC.md](FACE_ANALYSIS_SPEC.md)**
> · sprint tracker **[TASKS.md → Face Analysis](TASKS.md)** · system overview
> **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## 1. Design philosophy

This pipeline is **classical computer vision, not a deep-learning skin model**.
Every metric is computed from interpretable colour-space statistics and texture
descriptors over precise facial regions. The only neural network involved is
Google's **MediaPipe FaceLandmarker** (used purely for *where the face is*, not
*how healthy the skin is*).

Why this approach:

- **Explainable & deterministic** — each score traces back to a concrete formula
  (e.g. "oiliness = ratio of specular-highlight pixels in the T-zone"). No
  opaque black box, no per-skin-condition training set to curate or bias-audit.
- **Cheap & fast** — runs on CPU in a background task; no GPU, no model serving.
- **Degrades gracefully** — when the landmark model is unavailable it falls back
  to OpenCV face detection, and finally to a centred crop, so a scan almost
  never hard-fails (see §6).

⚠️ **Wellness, not diagnosis.** Outputs are wellness indicators framed in
Traditional Chinese Medicine (TCM) terms, **not** medical measurements or a
clinical diagnosis.

---

## 2. Libraries & dependencies

From `backend/requirements.txt` (AI block):

| Library | Pin | Role in the pipeline |
|---|---|---|
| **mediapipe** | `>=0.10.14` | FaceLandmarker model — 478-point 3D face mesh (primary face detector) |
| **opencv-python-headless** | `>=4.10.0` | All image I/O, colour-space conversion, Canny/Laplacian/Gaussian, Haar-cascade fallback, GrabCut (tongue, planned) |
| **scikit-image** | `>=0.24.0` | GLCM texture descriptors (`graycomatrix` / `graycoprops`) — homogeneity, contrast, energy |
| **Pillow** | `>=10.4.0` | Image decode/recompress helpers (server-side JPEG recompression is a Sprint 6 item) |
| **numpy** | `>=2.0` | Array math underpinning every analyzer |
| **python-magic** | `>=0.4.27` | MIME sniffing on upload (`python-magic-bin` on Windows) |

**Runtime note (important):** `mediapipe` / `opencv` / `scikit-image` wheels are
only published for **Python ≤ 3.12**. On Python 3.13/3.14 the server still boots,
but `import mediapipe` fails — the pipeline then runs in **OpenCV-only fallback
mode** (§6). Install the AI stack in a Python 3.12 venv (or conda) for the full
landmark pipeline.

---

## 3. Models

### 3.1 MediaPipe FaceLandmarker (primary)

- **Asset:** `backend/app/ai/face_landmarker.task` (float16 variant), auto-downloaded
  on first use from Google's `storage.googleapis.com/mediapipe-models/...` if absent
  (`face_detector._download_model()`).
- **Output:** up to **478 normalized 3D landmarks** for one face (`num_faces=1`),
  `min_face_detection_confidence=0.5`, `RunningMode.IMAGE`.
- **Singleton:** created lazily and cached at module level
  (`face_detector.get_face_detector()`); BGR→RGB conversion happens inside `detect()`.
- **Used for:** (a) precise ROI extraction via landmark indices, (b) facial
  **symmetry** (muscle-tone metric), (c) the on-device **mesh overlay** drawn over
  the captured still (landmarks are serialized to compact normalized `[[x,y],…]`
  JSON in `scan.landmarks_json`).

### 3.2 OpenCV Haar cascades (fallback detector)

- `haarcascade_frontalface_default.xml`, then `haarcascade_frontalface_alt2.xml`
  (shipped with OpenCV).
- Runs on a **histogram-equalised** grayscale image with relaxed params
  (`scaleFactor=1.1, minNeighbors=3`) to cope with phone-selfie lighting.
- Returns a single bounding box (largest face); ROIs are then derived
  proportionally from that box rather than from landmarks.

### 3.3 Centred-crop heuristic (last resort)

If both detectors miss, the pipeline analyses a **centred crop** (`_center_bbox`,
~62%×64% of the frame, offset 16% from the top) instead of failing — the capture
UI guides the user to centre their face in an oval, so this is a reasonable ROI
source.

---

## 4. Region-of-interest (ROI) extraction

Each metric is measured over the facial zones where it actually manifests. With
landmarks, zones are bounding boxes around named MediaPipe index sets (4 %
padding) in `image_preprocessor._ZONE_INDICES`:

| Zone | Example landmark indices | Feeds |
|---|---|---|
| `forehead` | 10, 151, 9, 8 | wrinkle, elasticity, inflammation |
| `left_cheek` / `right_cheek` | 116,123,187,207 / 345,352,411,427 | hydration, pigmentation, pore, inflammation, dark-circle baseline |
| `t_zone` | 1, 4, 19, 94, 164, 2 | oiliness |
| `under_eye_l` / `under_eye_r` | 226–231 / 446–451 | dark circles |
| `jawline` | 172,136,150,…,365 | elasticity |
| `eye_corners_l` / `eye_corners_r` | 33,133,159,145 / 362,263,386,374 | wrinkle (crow's feet) |
| `temples_l` / `temples_r` | 54,103,67,109 / 284,332,297,338 | (reserved) |

In fallback mode the same named zones are cut from the bounding box by fixed
proportions (`scan_pipeline_service._rois_from_bbox`).

---

## 5. The 9 skin analyzers (techniques)

All analyzers live in `backend/app/ai/analyzers/`, return a **0–100** float, and
**fail soft** to a neutral default if the ROI is missing/too small. They run
**in parallel** in a `ThreadPoolExecutor(max_workers=4)`.

| # | Metric | Technique | Direction | Default |
|---|---|---|---|---|
| 1 | **Hydration** | Lab **L\*** brightness + **GLCM homogeneity** (skimage) on both cheeks, averaged | ↑ = more hydrated | 50 |
| 2 | **Oiliness** | Ratio of **specular-highlight** pixels (HSV **V > 220**) in the T-zone + mean saturation | ↑ = more oily | 30 |
| 3 | **Wrinkle** | **Canny** edge density + **GLCM contrast** on forehead & eye-corners | ↑ = more wrinkled | 20 |
| 4 | **Pigmentation** | Std-dev of Lab **a\*/b\*** within an HSV **skin mask** (colour unevenness) | ↑ = more uneven | 25 |
| 5 | **Dark circles** | Lab **L\*** delta: cheek brightness − under-eye brightness | ↑ = darker circles | 30 |
| 6 | **Pore visibility** | **High-pass** (image − Gaussian blur) variance on cheeks | ↑ = more visible | 25 |
| 7 | **Elasticity** | **GLCM energy** (texture uniformity) on jawline & forehead | ↑ = better elasticity | 60 |
| 8 | **Muscle tone** | **Bilateral landmark symmetry** around the nose-tip axis (10 L/R pairs) | ↑ = better symmetry | 70 (60 in fallback*) |
| 9 | **Inflammation** | Mean Lab **a\*** (redness) on cheeks & forehead | ↑ = more inflamed | 15 |

\* Muscle tone needs landmarks; in OpenCV-fallback mode (no landmarks) it is set
to a neutral **60**.

**Shared building blocks**

- **CIE L\*a\*b\*** (`cv2.COLOR_BGR2Lab`) — perceptual lightness (L) and the
  red-green (a) / blue-yellow (b) axes; OpenCV packs all three into 0–255.
- **HSV** — Value channel for specular highlights, Hue/Sat for skin masking.
- **GLCM** (Gray-Level Co-occurrence Matrix, skimage) on a 64×64 downscaled
  patch, distances `[1]`, angles `[0, π/2]` — yields *homogeneity*, *contrast*,
  *energy*.
- **Canny / Laplacian / Gaussian** — edges, focus (blur), and high-pass detail.

Each formula is small and auditable — read the corresponding file in
`analyzers/` for the exact constants and clipping.

---

## 6. Graceful-degradation ladder

The pipeline tries the most accurate path first and steps down rather than
failing (`scan_pipeline_service._run_face_pipeline`):

```
1. MediaPipe FaceLandmarker  → 478 landmarks → landmark-precise ROIs   (best)
2. (MediaPipe missing/raises) → OpenCV Haar cascade → bbox → proportional ROIs
3. (Haar misses)              → centred-crop bbox → proportional ROIs
4. (image unusable)           → fail with a friendly retake message
```

`raw_metrics.cv_fallback` records whether a fallback path was taken, and
`face_detected` / `face_confidence` are persisted on the scan. The detected
geometry is serialized for the client overlay as either a **mesh** (landmarks)
or a **bbox** rect.

Quality gates before analysis:

- **Blur** — Laplacian variance; only **< 30** is rejected ("too blurry").
  (The original 100 threshold failed most phone selfies — relaxed deliberately.)
- **Lighting** — mean Lab **L\*** in ~`[100, 210]` = "good", else "poor"
  (recorded, not a hard gate).
- **Resize** — long edge capped at **800 px** (`INTER_AREA`) for consistent,
  fast analysis.

---

## 7. Composite scoring

After the 9 metrics are computed:

**Glow score** (`glow_score_engine.compute`, weights sum to 1.0):

```
glow = hydration·0.20 + (100−oiliness)·0.10 + (100−wrinkle)·0.15
     + (100−pigmentation)·0.15 + (100−dark_circle)·0.10 + (100−pore)·0.10
     + elasticity·0.10 + muscle_tone·0.05 + (100−inflammation)·0.05
```

**Toxin indicator** (`toxin_indicator.compute`):

```
toxin = dark_circle·0.40 + oiliness·0.30 + (100−glow)·0.30
```

**Skin-age estimate** — heuristic around a 30-year baseline, nudged by wrinkle
and elasticity, clamped to `[18, 70]`.

**Overall wellness score** — `glow·0.7 + (100 − toxin)·0.3`.

`raw_metrics` carries the audit trail: `blur_score`, `lighting`,
`landmark_count`, `cv_fallback`, and the sprint tag.

---

## 8. From scores to advice — the TCM recommendation engine

`backend/app/services/recommendation_engine_service.py` maps thresholds on the
metrics to **Traditional Chinese Medicine** patterns and concrete actions
(routines + wellness tips). It is a transparent rule engine (no ML), returns up
to **8** items sorted by priority. Representative rules:

| Trigger | TCM pattern | Recommendation |
|---|---|---|
| glow < 50 | Qi/Blood stagnation | *Morning Glow* acupressure routine |
| hydration < 40 | Yin deficiency | Boost hydration / Yin-nourishing foods |
| wrinkle > 60 | Yin/Blood deficiency | Antioxidant-rich foods |
| pigmentation > 60 | Blood stagnation | *Gua Sha Flow* routine |
| dark_circle > 60 | Qi deficiency | Prioritise sleep |
| inflammation > 60 | Heat in Blood | Reduce refined sugars / cooling foods |
| oiliness > 70 | Dampness-heat | Reduce dairy + Gua Sha |
| elasticity < 40 | Qi/Blood deficiency | Collagen-rich foods |
| toxin > 60 | Dampness toxins | Detox water / lymphatic drainage |
| muscle_tone < 40 | Qi deficiency | *Facial Acupressure* routine |
| pore > 60 | Dampness | Reduce sugar |
| (tongue rules — yellow coat / dry / pale / dark-red body) | Damp-heat / Yin def. / Qi-Blood def. / Heat in Blood | matched routines & foods |
| elasticity ≥ 70 **and** glow ≥ 70 | — | "Excellent vitality" celebration |
| overall < 40 | — | Suggest a practitioner consultation |

Routine keys (`MorningGlow`, `NightRepair`, `GuaShaFlow`, `FacialAcupressure`)
link recommendations to the Face Glow routine catalog.

---

## 9. End-to-end flow & progress stages

`run_scan_pipeline(scan_id, scan_type)` runs as a FastAPI **BackgroundTask**
with its **own** `SessionLocal()` (the request session is already closed). It
streams progress so the mobile `ScanProcessingScreen` can show stage text:

```
preprocessing → detecting → analyzing → scoring → done
```

Steps: load image (Cloudinary or local) → resize → store dims → blur gate →
lighting → **face pipeline (detect → ROIs → 9 analyzers → composites)** →
persist `ScanResult` → generate + persist recommendations → mark `completed`.
On any exception the scan is marked `failed` with a friendly,
retake-oriented message while the full traceback is logged.

---

## 10. Tongue analysis (planned — Sprint 4)

Currently returns **mock** TCM scores (`_MOCK_TONGUE_SCORES`). The planned
pipeline (see TASKS.md T36) is **GrabCut** tongue segmentation → Lab colour
classification of TCM dimensions (body colour, coat colour/thickness, moisture,
shape) → TCM combination rules.

---

## 11. Limitations & honest caveats

- **Not a medical device.** Wellness indicators only; no diagnostic claim.
- **Lighting/white-balance sensitive.** Colour-space metrics (pigmentation,
  inflammation, dark circles) shift with ambient light and phone auto-white-balance.
  The lighting check is informational, not corrective.
- **Confidence is heuristic.** MediaPipe success is reported as a fixed 0.95 and
  Haar as 0.85 — these are pipeline-path markers, not calibrated probabilities.
- **Skin-tone fairness.** The HSV skin mask and absolute Lab thresholds were
  tuned on limited samples; broaden the test matrix (3+ skin tones, see TASKS.md
  T35) before relying on cross-tone comparability.
- **Fallback mode is coarser.** Proportional ROIs from a bounding box are less
  precise than landmark ROIs, and muscle tone is neutralised without landmarks.
