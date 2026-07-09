# Face & Tongue Analysis — Technical Specification

**Feature:** Face Glow Scan — AI-powered skin analysis, TCM tongue diagnosis, and personalised wellness recommendations
**Status:** Sprints 1–4 of 8 complete + Cycle 5 enhancements (2026-06-16). Consent UI (Sprint 5 slice) shipped. Remaining: social auth (Sprint 5), security/polish (Sprint 6), Celery (Sprint 7), premium/analytics (Sprint 8).
**Tracking:** Open items are section D of [TASKS.md](TASKS.md); per-cycle detail in [CHANGELOG.md](CHANGELOG.md); AI write-up in [FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)

---

## 1. Overview

The Face Glow Scan replaces the placeholder "Coming Soon" button in `FaceGlowScreen.js` with a complete AI-powered scan pipeline:

```
Mobile Camera Capture
  → Consent Gate
  → Backend Upload & Validation
  → AI Pipeline (async)
  → Score Storage
  → TCM Recommendation Engine
  → Mobile Results UI
  → Progress Tracking & Trend Charts
```

Both face scans (9 skin metrics) and tongue scans (5 TCM dimensions) flow through the same pipeline, differentiated by `scan_type: "face" | "tongue"`.

---

## 2. Technical Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| Image storage | **Cloudinary** (extend existing) | Already in use for session videos; avoids a second credential surface; URL transformation pipeline for free resize/crop |
| Async processing | **FastAPI BackgroundTasks** (Sprint 1-2) → **Celery + Redis** (Sprint 7) | Zero new infra at launch; API contract is identical so Celery swap is transparent to mobile |
| AI inference | **Backend Python only** (MediaPipe headless, OpenCV, scikit-image) | Centralised AI; simpler Android build; easier to iterate without app releases |
| Social auth | **Token-exchange pattern** (Google/Apple ID token → app JWT) | Integrates with existing `token_version` revocation; no OAuth session layer needed |
| Face routines | **DB-backed** (`face_glow_routines` table) | Prerequisite for scan recommendations that reference routines by key |
| Tongue scanning | **Same upload → async → poll flow** as face scan (`scan_type="tongue"`) | Reuses entire pipeline; GrabCut segmentation server-side for v1 |
| Score storage | **Individual numeric columns** in `scan_results` (not a JSON blob) | Enables SQL window functions for trend queries without JSON parsing |
| Recommendation engine | **TCM rule-based for v1**; hybrid CF+rules for v2 | No training data at launch; existing `therapy_sessions` table becomes implicit feedback signal |

---

## 3. Database Migrations

All 7 new migrations chain from existing head `e6f3a82d4c91`. **Current head: `a7b8c9d0e1f2`** — all applied.

```
e6f3a82d4c91  (user_preferences — previous head)
  └── a1b2c3d4e5f6  add_oauth_fields_to_users              ✅ Sprint 1
       └── b2c3d4e5f6a7  create_face_glow_routines_table   ✅ Sprint 1
            └── c3d4e5f6a7b8  create_user_consents_table   ✅ Sprint 1
                 └── d4e5f6a7b8c9  create_face_scans_table          ✅ Sprint 2
                      └── e5f6a7b8c9d0  create_scan_results_table   ✅ Sprint 2
                           └── f6a7b8c9d0e1  create_scan_recommendations_table  ✅ Sprint 2
                                └── a7b8c9d0e1f2  add_progress_and_landmarks_to_face_scans  ✅ Sprint 2
```

> **Note:** `a7b8c9d0e1f2` was **repurposed**. The original plan was `create_scan_notifications_table` (Sprint 4 / T37), but notifications were deferred (low value until FCM push delivery exists). This revision instead adds `progress_stage` + `landmarks_json` to `face_scans` (live progress stages + client-side mesh overlay). The `scan_notifications` table below is **not yet created**.

### Table Schemas

#### `users` additions (a1b2c3d4e5f6)
```sql
oauth_provider      VARCHAR(20)   NULL   -- 'google' | 'apple' | NULL for email users
oauth_provider_id   VARCHAR(255)  NULL
password                          → nullable (social-only accounts have no password)
INDEX ix_users_oauth ON (oauth_provider, oauth_provider_id)
```

#### `face_glow_routines` (b2c3d4e5f6a7)
```sql
id           SERIAL PK
key          VARCHAR(80)   UNIQUE NOT NULL
icon         VARCHAR(10)   NOT NULL           -- emoji
title        VARCHAR(150)  NOT NULL
duration     VARCHAR(30)   NOT NULL           -- "10 min"
benefits     JSON          NOT NULL           -- ["Reduces puffiness", ...]
category     VARCHAR(50)   NOT NULL DEFAULT 'acupressure'  -- acupressure|face_yoga|gua_sha
video_url    VARCHAR(500)
sort_order   INTEGER       NOT NULL DEFAULT 0
is_active    BOOLEAN       NOT NULL DEFAULT TRUE
created_at / updated_at  TIMESTAMP
```
Seeded with 4 routines from the former hardcode: MorningGlow, FacialAcupressure, NightRepair, GuaShaFlow.

#### `user_consents` (c3d4e5f6a7b8)
```sql
id               SERIAL PK
user_id          FK → users.id
consent_type     VARCHAR(50)   NOT NULL  -- 'scan_storage' | 'ai_training' | 'gdpr_data'
granted          BOOLEAN       NOT NULL DEFAULT FALSE
granted_at       TIMESTAMP
revoked_at       TIMESTAMP
ip_address       VARCHAR(45)
user_agent       VARCHAR(500)
consent_version  VARCHAR(20)   NOT NULL DEFAULT '1.0'
created_at / updated_at  TIMESTAMP
UNIQUE(user_id, consent_type)
INDEX ix_user_consents_user_id ON (user_id)
```

#### `face_scans` (d4e5f6a7b8c9)
```sql
id                       SERIAL PK
user_id                  FK → users.id
scan_type                VARCHAR(20)  DEFAULT 'face'    -- 'face' | 'tongue'
status                   VARCHAR(20)  DEFAULT 'queued'  -- queued|processing|completed|failed
image_url                VARCHAR(500)   -- Cloudinary raw upload
processed_image_url      VARCHAR(500)
image_public_id          VARCHAR(200)   -- Cloudinary public_id (required for deletion)
file_size_bytes          INTEGER
image_width              INTEGER
image_height             INTEGER
face_detected            BOOLEAN
face_confidence          NUMERIC(5,4)   -- 0.0000 – 1.0000
lighting_quality         VARCHAR(20)    -- 'good' | 'poor' | 'unknown'
blur_score               NUMERIC(6,4)   -- Laplacian variance; < 100 = too blurry
error_message            VARCHAR(500)
processing_started_at    TIMESTAMP
processing_completed_at  TIMESTAMP
progress_stage           VARCHAR(20)    -- live stage: preprocessing|detecting|analyzing|scoring|done (a7b8c9d0e1f2)
landmarks_json           JSON           -- 478-pt mesh for client overlay (a7b8c9d0e1f2)
created_at / updated_at  TIMESTAMP
INDEX ix_face_scans_user_created ON (user_id, created_at DESC)
INDEX ix_face_scans_status ON (status)
```

#### `scan_results` (e5f6a7b8c9d0)
```sql
id                     SERIAL PK
scan_id                FK → face_scans.id  UNIQUE
-- Face metrics (0–100 each, NULL for tongue scans):
hydration_score        NUMERIC(5,2)
oiliness_score         NUMERIC(5,2)
wrinkle_score          NUMERIC(5,2)
pigmentation_score     NUMERIC(5,2)
dark_circle_score      NUMERIC(5,2)
pore_score             NUMERIC(5,2)
elasticity_score       NUMERIC(5,2)
muscle_tone_score      NUMERIC(5,2)
inflammation_score     NUMERIC(5,2)
glow_score             NUMERIC(5,2)  -- weighted composite
toxin_indicator        NUMERIC(5,2)
-- Tongue metrics (NULL for face scans):
tongue_body_color      VARCHAR(30)   -- 'pale'|'red'|'dark_red'|'purple'|'normal'
tongue_coat_color      VARCHAR(30)   -- 'white'|'yellow'|'grey'|'none'
tongue_coat_thick      VARCHAR(20)   -- 'thin'|'thick'|'none'
tongue_moisture        VARCHAR(20)   -- 'dry'|'moist'|'wet'
tongue_shape           VARCHAR(30)   -- 'swollen'|'thin'|'cracked'|'normal'
-- Audit / AI retraining
raw_metrics            JSON          -- underlying CV signal values pre-scoring
overall_wellness_score NUMERIC(5,2)
skin_age_estimate      INTEGER       -- estimated years
created_at             TIMESTAMP
```

#### `scan_recommendations` (f6a7b8c9d0e1)
```sql
id                  SERIAL PK
scan_id             FK → face_scans.id
recommendation_type VARCHAR(30)  NOT NULL  -- 'routine'|'face_yoga'|'wellness_tip'|'video'
priority            INTEGER      NOT NULL DEFAULT 0  -- lower = higher priority
title               VARCHAR(200) NOT NULL
description         TEXT
routine_key         VARCHAR(80)  -- soft ref to face_glow_routines.key
video_url           VARCHAR(500)
tip_category        VARCHAR(50)  -- 'hydration'|'sleep'|'stress'|'detox'|'nutrition'
metadata            JSON
created_at          TIMESTAMP
INDEX ix_scan_recommendations_scan_id ON (scan_id)
```

#### `scan_notifications` (DEFERRED — T37, not yet created)
> Planned for `a7b8c9d0e1f2`, but that revision was repurposed (see note above). Deferred until FCM push delivery exists.
```sql
id                SERIAL PK
user_id           FK → users.id
scan_id           FK → face_scans.id
notification_type VARCHAR(30)  DEFAULT 'scan_complete'
sent_at           TIMESTAMP
read_at           TIMESTAMP
payload           JSON
created_at        TIMESTAMP
```

---

## 4. Backend: New Files

```
backend/app/
├── models/
│   ├── face_glow_routine.py         ✅ Sprint 1
│   ├── user_consent.py              ✅ Sprint 1
│   ├── face_scan.py                 ✅ Sprint 2
│   ├── scan_result.py               ✅ Sprint 2
│   ├── scan_recommendation.py       ✅ Sprint 2
│   └── scan_notification.py            ⏳ DEFERRED (T37)
│
├── schemas/
│   ├── scan.py                      ✅ Sprint 2  -- ScanUploadResponse, ScanStatusResponse, ScanHistoryItem
│   └── social_auth.py                 ⏳ Sprint 5 (not started)  -- GoogleAuthRequest, AppleAuthRequest
│
├── repositories/
│   ├── face_glow_routine_repository.py  ✅ Sprint 1  -- get_all(), get_by_key()
│   ├── consent_repository.py            ✅ Sprint 1  -- get_by_user(), upsert(), revoke_all(), delete_all()
│   ├── face_scan_repository.py          ✅ Sprint 2  -- create/get_by_id/get_by_user/set_status/set_progress/delete
│   ├── scan_result_repository.py        ✅ Sprint 2  -- incl. get_user_results (trends)
│   └── scan_recommendation_repository.py ✅ Sprint 2  -- bulk_create()
│
├── services/
│   ├── face_glow_routine_service.py  ✅ Sprint 1  -- cache-aside (Redis 1h TTL)
│   ├── consent_service.py            ✅ Sprint 1  -- grant/revoke/check
│   ├── upload_service.py             ✅ Sprint 2  -- MIME validate + Cloudinary upload (local-disk fallback)
│   ├── scan_pipeline_service.py      ✅ Sprint 2/3  -- orchestrates AI pipeline (BackgroundTask); graceful-degradation ladder
│   ├── recommendation_engine_service.py ✅ Sprint 3  -- TCM rule table → sorted recommendations (≥15 rules)
│   ├── scan_dashboard_service.py     ✅ Sprint 4  -- latest scores + trend arrays + compare
│   └── social_auth_service.py          ⏳ Sprint 5 (not started)  -- Google + Apple token validation
│   -- Note: tongue analysis was folded into ai/tongue/__init__.py + scan_pipeline_service
│      (no separate tongue_pipeline_service.py)
│
├── ai/                                                  ✅ Sprint 3 (+ Cycle 5 additions)
│   ├── face_detector.py             ✅  -- MediaPipe FaceLandmarker singleton; Haar-cascade fallback
│   ├── image_preprocessor.py        ✅  -- resize, blur_score, lighting, ROI extraction
│   ├── quality.py                   ✅ Cycle 5  -- MediaPipe-primary quality gate; tongue path (no_tongue check)
│   ├── enhance.py                   ✅ Cycle 5  -- background removal + crop for results display
│   ├── skin_model.py                ✅  -- optional trained-model hook (CV fallback when absent)
│   ├── analyzers/
│   │   ├── hydration_analyzer.py              -- Lab L* + GLCM homogeneity on cheek ROI
│   │   ├── oiliness_analyzer.py               -- HSV high-V pixel ratio on T-zone
│   │   ├── wrinkle_analyzer.py                -- Canny edge density + GLCM contrast, forehead/eye
│   │   ├── pigmentation_analyzer.py           -- Lab a*/b* std-dev across skin mask
│   │   ├── dark_circle_analyzer.py            -- Lab L* under-eye vs. cheek baseline delta
│   │   ├── pore_analyzer.py                   -- Laplacian variance of high-pass cheek patch
│   │   ├── elasticity_analyzer.py             -- GLCM energy + jaw contour roundness
│   │   ├── muscle_tone_analyzer.py            -- bilateral landmark symmetry + jaw angle
│   │   ├── inflammation_analyzer.py           -- Lab mean a* (redness) + LBP spot count
│   │   ├── glow_score_engine.py               -- weighted composite (see weights below)
│   │   └── toxin_indicator.py                 -- dark_circle + oiliness + (100 − glow)
│   └── tongue/                                          ✅ Sprint 4
│       ├── segmenter.py             ✅  -- GrabCut isolation of tongue region (reddish-mask refine, ellipse fallback)
│       ├── color_analyzer.py        ✅  -- Lab/HSV TCM classification
│       ├── tcm_rules.py             ✅  -- TCM combination → health indicator lookup table
│       └── __init__.py              ✅  -- analyze() orchestrator
│
├── api/v1/endpoints/
│   ├── face_scan.py     ✅ Sprint 2/4  -- all scan CRUD + dashboard/trends/compare + quality-preview (prefix: /face-glow)
│   ├── consent.py       ✅ Sprint 1  -- GDPR consent CRUD (prefix: /consent)
│   └── social_auth.py      ⏳ Sprint 5 (not started)  -- Google/Apple token exchange (prefix: /auth)
│
└── worker/                 ⏳ Sprint 7 (not started)  -- Celery migration
    ├── celery_app.py
    └── tasks.py
```

### Glow Score Weights

```
glow_score =
    hydration_score     × 0.20
  + (100 − oiliness)   × 0.10
  + (100 − wrinkle)    × 0.15
  + (100 − pigment)    × 0.15
  + (100 − dark_circle)× 0.10
  + (100 − pore)       × 0.10
  + elasticity         × 0.10
  + muscle_tone        × 0.05
  + (100 − inflam.)    × 0.05
```

---

## 5. API Endpoints

All endpoints require a valid access token (`Authorization: Bearer {token}`).

### Scan Endpoints (prefix: `/api/v1/face-glow/`)

| Method | Path | Sprint | Description |
|--------|------|--------|-------------|
| POST | `/face-glow/scan/upload` | ✅ 2 | Multipart JPEG upload; validates consent; returns `scan_id` + `status: "queued"` (202) |
| GET | `/face-glow/scan/{id}/status` | ✅ 2 | Poll for results; returns scores + recommendations + `progress_stage` when processing |
| GET | `/face-glow/history` | ✅ 2 | Paginated scan history; `?scan_type=face\|tongue\|all&page=1&limit=20` |
| DELETE | `/face-glow/scan/{id}` | ✅ 2 | Hard-delete scan + Cloudinary images (GDPR) |
| POST | `/face-glow/quality-preview` | ✅ Cycle 5 | Live camera quality check on a frame; **no scan created** (backs in-viewfinder hints) |
| GET | `/face-glow/dashboard` | ✅ 4 | Latest scores, 7-day rolling glow, delta vs. previous scan |
| GET | `/face-glow/trends` | ✅ 4 | `?metric=glow_score&days=30` → `[{date, value}]` for charts |
| POST | `/face-glow/scan/{id}/compare` | ✅ 4 | Body: `{compare_to_id}` → metric delta object |
| DELETE | `/face-glow/data` | ⏳ 5 | GDPR: delete ALL scans for user + revoke all consents (not started) |

### Routine Endpoints (existing, now DB-backed)

| Method | Path | Sprint | Description |
|--------|------|--------|-------------|
| GET | `/face-glow/routines` | ✅ 1 | All active routines from `face_glow_routines` table |
| GET | `/face-glow/routines/{key}` | ✅ 1 | Single routine by key |

### Consent Endpoints (prefix: `/api/v1/consent/`)

| Method | Path | Sprint | Description |
|--------|------|--------|-------------|
| GET | `/consent/` | ✅ 1 | All consent records for current user |
| POST | `/consent/` | ✅ 1 | Grant/update: `{consent_type, granted}` |
| DELETE | `/consent/{type}` | ✅ 1 | Revoke specific consent type |

### Social Auth Endpoints (Sprint 5 — ⏳ not started)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/social/google` | Google ID token → app JWT pair |
| POST | `/auth/social/apple` | Apple identity token → app JWT pair |

---

## 6. AI Processing Pipeline (Full Flow)

```
[Mobile]
  1. User taps "Start Face Analysis" → FaceScanScreen opens (Vision Camera)
  2. User captures photo
  3. react-native-image-resizer pre-resizes to max 1280px, JPEG quality 85
  4. ConsentModal shown if no scan_storage consent on record
  5. POST /face-glow/scan/upload (multipart, scan_type=face)

[Backend – synchronous request handler]
  6.  UploadService.validate():
        - python-magic MIME check (must be image/jpeg or image/png)
        - File size ≤ 15 MB (SCAN_MAX_FILE_SIZE_MB setting)
        - Dimensions min 400×400 via Pillow
        - Single-face pre-check via OpenCV Haar cascade
  7.  Upload raw image → Cloudinary folder: face_scans/{user_id}/raw/
  8.  Create FaceScan record (status=queued, image_url set)
  9.  Enqueue BackgroundTask: run_scan_pipeline(scan_id, scan_type)
  10. Return 202: {scan_id, status: "queued", estimated_seconds: 10}

[Backend – BackgroundTask (creates own SessionLocal)]
  11. FaceScan.status = "processing", processing_started_at = now()
  12. Download image from Cloudinary → numpy array
  13. image_preprocessor.resize_normalize() → standard width 800px
  14. image_preprocessor.detect_blur()  → blur_score < 100 = mark failed
  15. image_preprocessor.detect_lighting() → "good" if Lab L* 40–80
  16. face_detector.detect() (MediaPipe FaceLandmarker, 478 landmarks)
        → face_confidence < 0.85 = mark failed, face_detected=False
  17. image_preprocessor.extract_face_roi() → dict of named ROI arrays:
        forehead, left_cheek, right_cheek, under_eye_L, under_eye_R, t_zone, jaw
  18. Run 9 analyzers via ThreadPoolExecutor:
        hydration, oiliness, wrinkle, pigmentation, dark_circle,
        pore, elasticity, muscle_tone, inflammation
  19. glow_score_engine.compute(all_analyzer_outputs)
  20. toxin_indicator.compute(dark_circle_score, puffiness, dullness)
  21. Create ScanResult record (all numeric scores + raw_metrics JSON)
  22. recommendation_engine_service.generate(scan_result) → ordered list (≥15 TCM rules)
  23. Create ScanRecommendation records (bulk insert)
  24. Upload preprocessed image → Cloudinary: face_scans/{user_id}/processed/
  25. FaceScan.status = "completed", processing_completed_at = now()
  26. Create ScanNotification record

[Mobile – polling]
  27. ScanProcessingScreen polls GET /face-glow/scan/{id}/status every 3 seconds
  28. status = "completed" → navigate to ScanResultsScreen
  29. status = "failed"    → show error with retry button
  30. Timeout after 60 seconds → user-friendly error
```

### Tongue Scan Differences

Same flow as face scan, with these changes at steps 16–20:
- Step 16: no MediaPipe landmark detection; use OpenCV GrabCut for tongue isolation
- Steps 17–20: run `tongue_pipeline_service`:
  - GrabCut segmentation → tongue mask
  - Convert to Lab color space
  - Classify body color (mean Lab a*/b* → pale/red/dark_red/purple/normal)
  - Classify coat color and thickness (bright center region ratio)
  - Moisture: specular highlight ratio (high HSV Value pixels)
  - Shape: contour analysis (width/length ratio, edge density for cracks)
  - Map TCM combination → `tcm_rules.py` health indicators

---

## 7. Face Landmark Zones (MediaPipe 478-point model)

| Zone | Landmark Indices | Analyzer Used By |
|------|-----------------|-----------------|
| Forehead center | 10, 151, 9, 8 | wrinkle, elasticity |
| Under-eye L/R | 226–229 / 446–449 | dark_circle, toxin |
| Cheeks L/R | 116, 123 / 345, 352 | hydration, pigmentation |
| T-zone (nose bridge) | 1, 4, 19, 94 | oiliness |
| Jawline | 172, 136, 150, 149, 176, 148, 152, 377 | elasticity, muscle_tone |
| Eye corners | 33, 133 / 362, 263 | wrinkle |
| Temples | 54, 103, 67, 109 / 284, 332, 297, 338 | muscle_tone |

---

## 8. TCM Recommendation Rules (v1, Sprint 3)

Minimum 15 rules mapping score thresholds to recommendations:

| Condition | TCM Pattern | Recommendations |
|-----------|-------------|----------------|
| `hydration_score < 40` | Yin deficiency | Tip: drink 8 glasses water; routine: NightRepair |
| `inflammation_score > 60` | Heat in blood | Tip: reduce refined sugars; routine: FacialAcupressure |
| `dark_circle_score > 60` | Qi deficiency | Tip: sleep 7–8 hours; routine: NightRepair |
| `glow_score < 50` | Qi/Blood stagnation | Routine: MorningGlow (high priority) |
| `oiliness_score > 70` | Dampness-heat | Tip: reduce dairy; routine: GuaShaFlow |
| `wrinkle_score > 60` | Yin/Blood deficiency | Tip: antioxidant foods; routine: NightRepair |
| `pigmentation_score > 60` | Blood stagnation | Routine: GuaShaFlow |
| `elasticity_score < 40` | Qi/Blood deficiency | Tip: collagen-rich foods; routine: FacialAcupressure |
| `toxin_indicator > 60` | Dampness toxins | Tip: detox water; routine: GuaShaFlow |
| `muscle_tone_score < 40` | Qi deficiency | Routine: FacialAcupressure (face yoga) |
| `tongue_coat_color = yellow` | Damp-heat | Tip: cooling foods; routine: GuaShaFlow |
| `tongue_moisture = dry` | Yin deficiency | Tip: yin-nourishing foods; routine: NightRepair |
| `tongue_body_color = pale` | Qi/Blood deficiency | Routine: MorningGlow |
| `tongue_body_color = dark_red` | Heat in blood | Routine: FacialAcupressure |
| `pore_score > 60` | Dampness | Tip: reduce sugar; routine: GuaShaFlow |

---

## 9. Mobile: New Files

```
mobile-users/src/
├── screens/
│   ├── FaceScanScreen.js          ✅ Sprint 2  -- Vision Camera, oval guide, consent gate, live quality hints
│   ├── ScanProcessingScreen.js    ✅ Sprint 2  -- poll loop, live stage text, animated indicator
│   ├── ScanResultsScreen.js       ✅ Sprint 2  -- glow score, 9 metric rows, recommendations, enhanced image
│   ├── ScanErrorScreen.js         ✅ Sprint 2  -- friendly retake message on failed/timeout
│   ├── ScanHistoryScreen.js       ✅ Sprint 4  -- FlatList + pagination, filter tabs
│   ├── ScanComparisonScreen.js    ✅ Sprint 4  -- Before/after delta view
│   ├── ScanDashboardScreen.js     ✅ Sprint 4  -- Trend charts, Start Scan CTA
│   ├── ConsentScreen.js           ✅ Sprint 5  -- GDPR toggles (scan_storage / ai_training / gdpr_data)
│   └── TongueScanScreen.js        ✅ Cycle 5  -- separate tongue framing guide + flow (was shared with FaceScan)
│
├── components/scan/
│   ├── MetricScoreRow.js          ✅ Sprint 2  -- Label + color bar + score (green/amber/red)
│   ├── RecommendationCard.js      ✅ Sprint 2  -- type, title, description, onPressRoutine
│   ├── FaceOverlayGuide.js        ✅ Sprint 2  -- SVG oval guide on camera preview (status-coloured)
│   ├── FaceMeshOverlay.js         ✅ Sprint 2  -- 478-pt mesh overlay from landmarks_json
│   ├── TongueOverlayGuide.js      ✅ Cycle 5  -- tongue framing guide on camera preview
│   ├── TrendChart.js              ✅ Sprint 4  -- SVG line chart [{date, value}] (no chart-kit dep)
│   ├── GlowScoreGauge.js             ⏳ Sprint 6 (not started)  -- animated SVG circular arc
│   └── ScanHistoryCard.js            ⏳ Sprint 6 (not started; history uses inline rows)
│
├── services/
│   ├── scanService.js             ✅ Sprint 2  -- uploadScan(), getScanStatus(), getHistory(), delete(), qualityPreview()
│   ├── consentService.js          ✅ Sprint 5  -- getConsents(), grantConsent(), hasConsent()
│   └── socialAuthService.js          ⏳ Sprint 5 (not started)  -- loginWithGoogle(), loginWithApple()
│
└── store/
    └── scanStore.js               ✅ Sprint 2  -- Zustand: latestScan, scanHistory, isProcessing
```

### Mobile: Files Modified

| File | Change | Sprint |
|------|--------|--------|
| `screens/FaceGlowScreen.js` | Replace `Alert.alert('Coming soon!')` with scan entry (face + tongue) | ✅ 2 |
| `constants/apiEndpoints.js` | Add scan/consent endpoint constants (+ quality-preview) | ✅ 2 |
| `screens/SettingsScreen.js` | Add "Privacy & Data Consent" row → ConsentScreen | ✅ 5 |
| `App.tsx` | Add new scan screens to HomeStack | ✅ 2 |
| `screens/LoginScreen.js` | Add Google Sign In button | ⏳ 5 (not started) |

### New npm Packages

| Package | Version | Sprint | Status |
|---------|---------|--------|--------|
| `react-native-vision-camera` | `4.6.4` | 2 | ✅ |
| `react-native-image-resizer` | `3.0.10` | 2 | ✅ |
| `react-native-svg` | `^15.0.0` | 2 | ✅ |
| `react-native-chart-kit` | `^6.12.0` | 4 | ❌ dropped — TrendChart uses react-native-svg directly |
| `@react-native-google-signin/google-signin` | `^13.0.0` | 5 | ❌ dropped — social sign-in goes through Firebase Auth's built-in provider flow (docs/FIREBASE.md) |
| `@invertase/react-native-apple-authentication` | `^2.4.0` | 5 | ❌ dropped — same: Firebase Auth covers providers; no iOS build yet |
| `react-native-view-shot` | `^3.8.0` | 6 | ⏳ not started |

---

## 10. New Python Dependencies

| Package | Version | Sprint | Purpose |
|---------|---------|--------|---------|
| `python-multipart` | `>=0.0.9` | ✅ 1/2 | Multipart file upload parsing |
| `cloudinary` | `>=1.40.0` | ✅ 1/2 | Image storage |
| `opencv-python-headless` | `4.10.0.84` | ✅ 3 | Face detection, image analysis |
| `mediapipe` | `>=0.10.14` | ✅ 3 | Face Landmarker (478 3D landmarks) |
| `Pillow` | `10.4.0` | ✅ 3 | Image open/resize/convert |
| `scikit-image` | `0.24.0` | ✅ 3 | GLCM texture features |
| `python-magic` | `0.4.27` | ✅ 3 | Byte-level MIME type verification |
| `numpy` | `>=2` | ✅ 3 | Array operations |
| `google-auth` | `>=2.28.0` | ⏳ 5 | Google ID token verification (not started) |
| `cryptography` | `>=42.0.0` | ⏳ 5 | Apple Sign In JWKS validation (not started) |
| `celery` | `>=5.4.0` | ⏳ 7 | Async task queue (not started) |

> **Runtime note:** the mediapipe/opencv/scikit-image wheels target Python ≤3.12. The server **boots without them** and runs an OpenCV-only fallback; full MediaPipe analysis requires a Python ≤3.12 environment with the wheels installed.

> Note: Use `opencv-python-headless` (not `opencv-python`) on the server — no Qt/GUI dependencies, works on headless Linux.

---

## 11. Critical Implementation Notes

1. **BackgroundTask DB session** — The background task must create its own `SessionLocal()`. The request's `db` session is closed when the HTTP response returns. Pass `scan_id` only; the task opens a fresh session.

2. **MediaPipe singleton** — Initialise `FaceLandmarker` once at app startup via a FastAPI `lifespan` handler, stored on `app.state`. Cold start ~2s; per-request cost ~35ms.

3. **Cloudinary deletion** — The delete endpoint must call `cloudinary.uploader.destroy()` for both `image_public_id` AND `processed_image_public_id` before deleting the DB record. Always store `image_public_id` separately from the URL.

4. **Apple Sign In — full name is one-time** — Apple only sends `full_name` on the first authorisation. The mobile must capture it from the response and include it in `AppleAuthRequest`. It will never be sent again.

5. **Social users + password** — `auth_service.login()` must check `if user.oauth_provider and user.password is None` and return 400 "This account uses social login" before calling `verify_password()`.

6. **Consent gate** — `POST /face-glow/scan/upload` returns 403 `"Scan storage consent required"` if no active `scan_storage` consent exists. The mobile shows `ConsentModal` and re-submits.

7. **face_glow.py prefix** — All new scan endpoints share the existing `/face-glow/` prefix. The mobile's `FACE_GLOW_SCAN` constant in `apiEndpoints.js` maps to `POST /api/v1/face-glow/scan/upload`.

8. **Cloudinary signed URLs** — Sprint 6: switch to authenticated delivery so images are not publicly accessible. Store `image_public_id` (not just URL) in `face_scans` from Sprint 2 onward.

---

## 12. Verification Checklist by Sprint

### Sprint 1 ✅
- [x] `GET /api/v1/face-glow/routines` returns 4 routines from DB (not hardcode)
- [x] `POST /api/v1/consent/` `{consent_type: "scan_storage", granted: true}` → 200
- [x] `GET /api/v1/consent/` returns the created record
- [x] `DELETE /api/v1/consent/scan_storage` → 200, `granted: false`

### Sprint 2 ✅
- [x] `POST /face-glow/scan/upload` with JPEG → `{scan_id: N, status: "queued"}` (202)
- [x] `GET /face-glow/scan/N/status` → eventually `{status: "completed", results: {...}}`
- [x] `GET /face-glow/history` shows the scan
- [x] `DELETE /face-glow/scan/N` → 200; Cloudinary image deleted; DB row gone
- [x] Mobile camera screen opens, captures, shows live stages, then results

### Sprint 3 ✅
- [x] Well-lit frontal face → realistic `glow_score` (real CV, not 75.0 mock)
- [x] Dark/blurry image → `status: "failed"`, `error_message` set
- [x] No-face image → `face_detected: false`, descriptive error
- [ ] Formal pytest matrix across lighting / skin tones / angles (→ T43, Sprint 6)

### Sprint 4 ✅ (T37 deferred)
- [x] Tongue scan → real GrabCut segmentation + Lab/HSV TCM classification (not mock)
- [x] `GET /face-glow/dashboard` → latest scores + 7-day trend + delta
- [x] `GET /face-glow/trends?metric=glow_score&days=30` → `[{date, value}]`
- [x] `POST /face-glow/scan/{id}/compare` → metric delta object

### Cycle 5 ✅
- [x] Photo of an empty wall is **rejected** (`no_face`) — MediaPipe-primary quality gate
- [x] `POST /face-glow/quality-preview` returns assessment with **no scan created**
- [x] Live viewfinder colours (oval/brackets/pill/button) track the quality status
- [x] Separate `TongueScanScreen` with its own framing guide
- [x] App launcher label shows "Purnazen" (requires Android rebuild)

### Sprint 5 (⏳ social auth not started; Consent UI done)
- [ ] `POST /auth/social/google` with valid Google ID token → `{access_token, refresh_token, user}`
- [ ] Returned user has `oauth_provider: "google"`
- [x] ConsentScreen reachable from Settings → "Privacy & Data Consent"; scan upload 403s without `scan_storage` consent

### Sprint 7 (⏳ not started)
- [ ] `GET /health/detailed` → `{"celery": "ok", "redis": "ok", "cloudinary": "ok"}`
- [ ] Flower dashboard shows tasks processed from `scan_processing` queue
