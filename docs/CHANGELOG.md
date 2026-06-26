# Changelog

All notable changes to the Purnazen App are documented here.

## [2026-06-26] — OTA updates from private Azure Blob (no more public GitHub releases)

The in-app "Check for Updates" polled the **private** prod repo's GitHub Releases
API, which 401s unauthenticated — so updates never surfaced in prod. Replaced with
a backend-brokered flow against a **private** blob container. Full setup +
runbook: [OTA_RELEASES.md](OTA_RELEASES.md).

### Added — backend
- `app_releases` table + model/schema/repository/service and endpoints under
  `/app-releases`: JWT-gated `GET /latest?app=<slug>` and
  `GET /<slug>/<version>/download` (mints a ~15-min read-only SAS via the existing
  `azure_storage` helper), plus a CI-only `POST /app-releases` guarded by an
  `X-Release-Token` header. Keeps the newest `RELEASE_KEEP_VERSIONS` (4) per app.
  Migration `a4b5c6d7e8f9`. New config: `AZURE_RELEASES_CONTAINER_NAME`,
  `AZURE_RELEASE_SAS_EXPIRY_MINUTES`, `RELEASE_REGISTER_TOKEN`, `RELEASE_KEEP_VERSIONS`.

### Changed — apps & CI
- All three `updateService.js` now poll the backend (api client, JWT attached)
  instead of the GitHub API; force-update still supported via a `forced` flag.
- `release-mobile.yml`: after the signed build, logs in to Azure via **OIDC** and
  uploads the APK to the private `app-releases` container, then registers the
  version with the backend. Steps are skipped until `AZURE_STORAGE_ACCOUNT` is set,
  so they're non-breaking before infra is configured.

### Security
- Container stays private; per-request short-lived read-only SAS; storage key
  never leaves the server; CI uses OIDC (no long-lived cloud secret). Codebase
  stays private throughout.

## [2026-06-26] — Doctor app features (Dashboard, Patients, clinical records) + sign-up polish

### Added — clinical records (notes / diagnosis / prescription) persistence
- **Backend:** new `consultation_records` table + model, schema, repository,
  service and doctor-scoped endpoints under
  `/appointments/{id}/records` (GET/POST and `/{record_id}` PUT/DELETE). Records
  are owner-checked (a doctor can only touch their own appointments') and
  soft-deleted. Migration `f3a4b5c6d7e8` (**run migrations + redeploy** to apply).
- **Doctor app:** the Consultation Notes flow now persists — `consultationStore`
  is API-backed via a new `consultationService`; records load on open and
  add/edit/delete save to the server (were previously in-memory only).

### Added — doctor app screens
- **Dashboard:** real data from `GET /appointments/doctor` — today's count,
  pending requests, active patients, a today's-schedule list (tap → patient
  detail) and pull-to-refresh (replaces the hardcoded scaffold).
- **Patients tab + patient profile:** real screens. The roster is derived from
  the doctor's appointment feed (no separate patients table); profile shows full
  details (`GET /users/:id`) + visit history. Replaces the placeholders.

### Changed — user app sign-up
- `RegisterScreen` rebuilt on `LoginScreen`'s keyboard-aware pattern: fixes the
  empty band below the form and keyboard overlap; adds an inline password-match
  indicator. The root navigators (admin/doctor) drive Login↔Main from auth state.

## [2026-06-26] — Admin & Doctor app Profile/Settings parity (theme, biometric, alerts, trackers)

Brought the **admin** (`mobile-admin`) and **doctor** (`mobile-doctors`) apps up to
the patient app's Profile/Settings standard, keeping each app's brand color
(admin burnt-orange, doctor clinical-blue) while sharing the same UX system.

### Added — shared infrastructure (ported from `mobile-users`)
- **Dark mode**: each app's `constants/theme.js` refactored into
  `LIGHT_COLORS`/`DARK_COLORS` + `getColors(scheme)` (static `COLORS` still exports
  the light palette for unmigrated screens). New `store/themeStore.js` (persisted
  `light`/`dark`/`system`) + `hooks/useTheme.js`. `App.tsx` hydrates the theme,
  feeds the palette into `NavigationContainer` + the bottom tab bar, and the
  Settings "Dark Mode" toggle is now real.
- **Biometric login**: `services/biometricService.js` (react-native-keychain
  ACCESS_CONTROL; per-app keychain service id). Bootstrap requires fingerprint /
  Face ID before unlocking a restored session (fail-closed → Login); Settings
  toggle enrols/disenrols with a real OS prompt.
- **Themed alerts**: `utils/alert.js` (`showAlert`/`showConfirm`) + globally
  mounted `components/AppAlertHost.js`, replacing dated native `Alert.alert`.
- **Preferences**: `services/preferencesService.js` persists push/appointment/
  language prefs to `PUT /users/me/preferences` (added `PREFERENCES` to the doctor
  endpoints).

### Added — profile trackers
- **Admin** profile shows live **Doctors / Users / Appointments-today** from
  `GET /admin/stats` (fixes the previous permanently-stuck loading skeleton).
- **Doctor** profile shows **Today / Upcoming / Completed** derived from the
  doctor's own appointment list.

### Changed
- **Settings** reworked on both apps to the themed `ToggleRow`/`ArrowRow` card UI
  with real Edit Profile, **editable Phone** (`updateProfile({ phone })`), Change
  Password, Dark Mode, Biometric, Language, Check-for-Updates, and Help & Support.
  Patient-only rows dropped (session reminders, promotional emails, location/
  address, privacy/data consent, download-my-data).
- **Doctor** app gained a `ProfileStack` (Profile → Settings); admin/doctor root
  navigators are now session-aware (auth-state flip drives Login↔Main, so
  `LoginScreen`/`RegisterScreen` no longer imperatively `replace('Main')`).
- **Delete Account** intentionally omitted from both staff apps (accounts are
  provisioned server-side; the doctor app has no delete API).

### Docs
- Removed stale `docs/SCREENS.md` (user-app "all 20 screens" inventory, superseded
  by FEATURES.md; the app now has 30+ screens).
- Updated `SRS_AUDIT.md`, `FEATURES.md`, `ARCHITECTURE.md` and the per-app READMEs
  to reflect the native admin/doctor apps.

## [2026-06-19] — Rebrand to com.purnazen, app icon, dark mode, biometric login, header polish

### Changed — package rename `wellness` → `purnazen`
- **User app** application id / namespace `com.wellness` → **`com.purnazen`**;
  **admin app** → **`com.purnazen.admin`** (the two previously collided on a single
  id and could not co-install). Updated across `build.gradle` (namespace +
  `applicationId`), `settings.gradle` (`rootProject.name`), Kotlin package dirs
  (`java/com/wellness` → `java/com/purnazen[/admin]`) + `package` declarations,
  `MainActivity.getMainComponentName()`, `app.json` (`name`/`displayName`),
  `package.json`/`package-lock.json`, admin `strings.xml` label, and the keychain
  service keys in `secureStorage`. **Requires a clean Android rebuild + reinstall.**
- `app.json` displayName `M-Heal` → **Purnazen**.

### Added — branded app icon
- New **lotus** launcher icon (white lotus on brand-green `#1FA77A`): adaptive icon
  (`mipmap-anydpi-v26`, vector-safe foreground + monochrome/themed-icon support) plus
  regenerated legacy PNGs for every density. Generator: `scripts/generate_icon.py`.

### Added — appearance & security (Settings)
- **Dark mode**: persisted `themeStore` (`light`/`dark`/`system`) + `useTheme()` hook
  with live OS-scheme detection. Settings toggle is wired and saved; core shells
  themed (shared header, bottom tab bar, NavigationContainer background, Settings,
  Profile). Remaining screens migrate to the hook incrementally.
- **Biometric login**: `biometricService` built on `react-native-keychain` biometric
  ACCESS_CONTROL (no new native dep). Settings toggle enrols/disenrols with a real OS
  prompt; bootstrap requires fingerprint / Face ID before unlocking a restored session
  (fails closed to the password login screen).

### Changed — header / back-button consistency
- New shared **`ScreenHeader`** component: safe-area-driven height (no more per-screen
  hardcoded `paddingTop` of 50–60), a smart back button guarded by `canGoBack()`, theme
  awareness, and `brand`/`light` variants. Adopted across the plain pushed screens
  (Settings, Notifications, Subscriptions, Help & Support, Consent, Therapy History,
  Doctor Profile, Book Appointment, Payment). Bespoke module headers (scan flow,
  Face Glow, session players, chat, video) intentionally kept.

## [2026-06-17] — Repo restructure: two front-end apps + migration fix

### Added

- **`mobile-doctors/` — doctor-facing app (scaffolded skeleton).** A runnable
  React Native + Expo project mirroring `mobile-users`' toolchain and sharing the
  same FastAPI backend. Real auth (login/logout, keystore tokens namespaced
  `com.purnazen.doctor.*`, 401 silent-refresh), bottom-tab navigation
  (Dashboard, Appointments, Schedule, Patients, Profile) with detail stacks, a
  service layer (auth/appointment/availability/patient), and placeholder feature
  screens that document their intended backend endpoints. Distinct clinical-blue
  theme. Native `android/`/`ios/` are generated via `npx expo prebuild` (see
  `mobile-doctors/README.md`). No CI job yet (pending first lockfile).

### Changed

- **`mobile/` → `mobile-users/`.** The patient app folder was renamed; `node_modules`
  preserved (no reinstall needed). Updated CI `frontend` job + cache path, root
  `README.md`, `.gitignore` (now `mobile-*/` globs covering both apps), `seed_data.py`
  doc-comments, and all `docs/` path references.
- **`.gitignore`:** added `*.log.err` / `*.log.out` (the old `*.log` rule missed
  them) and `app-screen.png`.

### Fixed

- **Alembic `upgrade head` failed with "Multiple head revisions are present".**
  The git merge of the face-analysis + Development branches left three migration
  heads off the `e6f3a82d4c91` branchpoint; the DB sat on only one, so API calls
  500'd on tables/columns whose migrations were never applied. Resolved
  non-destructively with a merge migration (`82de73316d8d`) + `upgrade head`.
  Documented in `docs/RUNNING.md` §1.3.

### Removed

- Stray tracked artifacts: `app-screen.png`, `mobile/build-install.log.err`, and
  local run logs (`*.log`, `server.log*`).

## [2026-06-16] — Face Analysis Cycle 5.1: on-device fixes from live testing

Found by driving the app on a physical device (capture → results) and inspecting
the real pipeline output:

### Fixed

- **Results image half-black:** `ScanResultsScreen` set `width:'100%'` +
  `aspectRatio` + `maxHeight` together, which made Yoga shrink the image width and
  left-align it, exposing the black container on the right. Now a fixed-height
  (360) wrap + `width/height:'100%'` + `resizeMode:'cover'` — fills cleanly.
- **Enhanced preview showed black / unreachable images:** local image URLs were
  built with `http://10.0.2.2:5000` (Android-emulator alias) but the app reaches
  the API via `http://localhost:5000` (adb reverse). Added
  `LOCAL_UPLOADS_BASE_URL=http://localhost:5000` to backend `.env` so uploaded/
  enhanced images load on a physical device. Results screen also defaults to the
  reliably-loading local capture and falls back via `onError`.
- **Live viewfinder falsely showed "Ready":** a failed/404 quality-preview check
  defaulted the indicator to ready. Now it keeps the last known state (or
  "Detecting…") and never claims ready on error. (The 404 was also a stale-server
  symptom — the backend must be restarted to pick up new endpoints.)
- **Over-saturated CV scores:** on a real young face the CV analyzers returned
  wrinkle 100, pigmentation 94, skin-age 51. Recalibrated (ranking preserved):
  wrinkle caps the edge-density contribution + softer gains (forehead/eye ROIs
  catch hair/brows); pigmentation clips specular spikes + softer gains; `skin_age`
  uses a gentler slope and clamps to 18–58. Live re-test: wrinkle 68, pigmentation
  58, glow 39→51. (Precise per-metric accuracy still needs the trained model.)

### Enhanced live in-viewfinder (both face & tongue)

- The guide **oval, corner brackets, instruction pill, and capture button now
  change colour with the live status** — white "Detecting…", **green** "Perfect —
  hold still & tap to capture", **amber** with specific, oval-centric guidance
  ("Bring your face into the oval", "Move a little closer", "Align your face
  inside the oval", "Find brighter lighting", "Hold still"). Verified on device.

## [2026-06-16] — Face Analysis Cycle 5: separate tongue scan, live capture quality, cropped+zoomed mesh preview, app rebrand to Purnazen

### Branding

- **App renamed to "Purnazen"** (`android/.../values/strings.xml`, was "M-Heal").
- **New app icon** across all five mipmap densities (+ round variants): a
  purple→violet radial-gradient disc with a white lotus motif (generated with
  Pillow). **Native resource change — requires an Android rebuild to take effect.**

### Backend

- **Quality gate rewrite** (`app/ai/quality.py`): face detection now uses
  **MediaPipe FaceLandmarker as the primary detector** (Haar cascade only as a
  fallback when MediaPipe is unavailable). This fixes the reported bug where a
  photo of an empty wall passed validation and ran a full analysis — empty/no-face
  frames are now reliably rejected with `no_face`. `assess_quality(img, scan_type)`
  gained a `scan_type` arg and a **tongue path** (`no_tongue` check via reddish/pink
  region detection in the lower frame; skips face checks).
- **`POST /face-glow/quality-preview`** (`endpoints/face_scan.py`): runs the quality
  assessment on a frame **without creating a scan** — backs the live in-viewfinder
  hints. The upload gate now runs for **both face and tongue** (was face-only).
- **Tongue bbox** (`app/ai/tongue/__init__.py`): `analyze()` now returns the
  segmented tongue's normalized bounding box in `raw_metrics.tongue_bbox`; the
  pipeline serializes it to `landmarks_json` (`{type:'bbox',rect}`) so the mobile
  preview can crop+zoom to the detected tongue and outline it.
- **Display enhancement** (`app/ai/enhance.py`): rewritten to **detect the face,
  blur+darken the background** behind an elliptical mask, **crop to the face**
  (with padding), then denoise → CLAHE → vignette. The saved `processed_image_url`
  is now a tight portrait-style crop, not a full-frame filter.

### Mobile

- **Live capture quality hints:** both scan screens take a silent low-res snapshot
  every ~2.2–2.5 s, call `quality-preview`, and show a colour-coded badge
  (green "Ready to scan" / amber-red issue with icon — too dark, blurry, no face,
  move closer, centre, no tongue). `scanService.qualityPreview()` +
  `FACE_GLOW_QUALITY_PREVIEW` endpoint added.
- **Separate Tongue Scan screen** (`screens/TongueScanScreen.js`): standalone from
  the face flow — orange theme, `TongueOverlayGuide` (wider/shorter oval), cycling
  capture tips, a TCM explainer, and its own live quality hints. Registered as
  `TongueScan` in the Home stack.
- **FaceGlow** now shows **two distinct cards** — "AI Face Analysis" (purple) and
  "TCM Tongue Analysis" (orange) — instead of a face card with a tongue sub-link.
- **Cropped + zoomed mesh preview** (`ScanProcessingScreen.js`): the processing
  screen now **crops and zooms into the detected face/tongue so it fills the card**,
  with the **mesh/outline drawn on the zoomed image** (image and overlay share one
  coordinate system via the landmark-derived crop box, so they stay aligned), plus
  a radial background scrim. Tongue scans get their own 8 TCM-marker chips. This is
  the "enlarged, background-removed, cropped mesh preview" that was previously only
  approximated by widening the card.

### Verified

- Backend: 135 passed. Smoke-checked empty-wall rejection, tongue detection,
  enhance crop, and tongue bbox on synthetic images.
- Mobile: `tsc` clean, eslint 0 errors, 64 jest tests pass.

## [2026-06-16] — Face Analysis Sprint 4 + Consent UI: real tongue analysis, dashboard/trends/compare, GDPR consent screen

### Backend — Sprint 4

- **Real tongue pipeline** (`app/ai/tongue/`): GrabCut `segmenter` (reddish-mask
  refined, central-ellipse fallback) → Lab/HSV `color_analyzer` (body colour, coat
  colour/thickness, moisture, shape) → `tcm_rules` wellness score. Wired into
  `scan_pipeline_service` (replaces the tongue mock); the existing TCM tongue
  recommendation rules now fire on real markers.
- **Dashboard / trends / comparison:** `ScanResultRepository.get_user_results`
  (completed result+scan pairs), `scan_dashboard_service`, and endpoints
  `GET /face-glow/dashboard`, `GET /face-glow/trends?metric=&days=`,
  `POST /face-glow/scan/{id}/compare` (vs explicit id or the previous scan).
- Tests: `tests/test_scan_dashboard.py` (dashboard/trends/compare + tongue markers).

### Mobile — Sprint 4

- **ScanDashboardScreen:** latest glow gauge, 7-day rolling glow, scan count, a
  metric trend chart with a Glow/Hydration/Oil/Lines selector, and new-scan
  actions. New reusable `components/scan/TrendChart.js` (react-native-svg).
- **ScanComparisonScreen:** per-metric current-vs-previous deltas, colour-coded by
  whether each change is an improvement (direction-aware). Opened from results via
  "Compare to previous".
- **Tongue scan** reachable from FaceGlow ("or scan your tongue") and the dashboard
  (reuses the existing capture flow with `scanType: 'tongue'`).
- FaceGlow header gains Dashboard + History entry points. Endpoints + `scanService`
  methods (`getDashboard`, `getTrends`, `compareScan`) added.

### Mobile — Consent UI (Sprint 5 slice; OAuth deferred)

- **ConsentScreen** (Settings → "Privacy & Data Consent"): toggles for
  `scan_storage`, `ai_training`, `gdpr_data` against the existing consent API,
  optimistic with revert on failure. New `consentService.js`.

## [2026-06-16] — Face Analysis Cycles 2–4: all-metric calibration, animated processing UI, enhanced preview, history/reports, onboarding + TCM patterns

### Backend — analysis correctness (all metrics, not just oiliness)

- Empirically fixed analyzer **direction/scaling** (verified with synthetic
  condition patches, locked by `test_all_metrics_rank_correctly`):
  - **Pigmentation was inverted** — its narrow HSV skin-mask excluded the very
    spots it should measure, so pigmented skin scored *lower*. Rewritten to
    high-pass L* unevenness + Lab a*/b* spread over the cheeks.
  - **Pores** badly under-scaled (`variance/2` → ~0 everywhere) → recalibrated to
    fine high-pass std with a usable gain.
  - **Wrinkle / elasticity / dark-circle** gains softened so they spread across
    0–100 instead of slamming to 100.

### Backend — enhanced preview + pipeline

- New `app/ai/enhance.py` `enhance_for_display` (white balance → edge-preserving
  denoise → CLAHE → soft vignette) — **display only**, never fed to analyzers.
- Pipeline emits an `enhancing` stage and saves the enhanced image
  (`UploadService.store_processed`, sync) to `processed_image_url`; failures never
  fail the scan. Status payload now returns `image_url` + `processed_image_url`.

### Backend — recommendations (TCM)

- Added **combination/pattern rules** (surface ahead of single-metric tips):
  dehydrated-oily combination skin, congested/Damp-heat, fatigue (Qi-Blood
  depletion), ageing (Yin-Blood deficiency), post-inflammatory pigmentation.
  New `tests/test_recommendation_engine.py`.

### Mobile — Cycle 2: animated processing screen

- Rebuilt `ScanProcessingScreen`: large image, **colourful staggered pulse rings**
  + sweeping scan line, **professional icon chips** (no emojis) that fill green as
  each feature completes, **tap-to-reveal** what each measures, and a **transient
  label** flashing the just-finished feature. Progress stays honest (gated by the
  real backend stage).

### Mobile — Cycle 3: reports & history

- `ScanResultsScreen`: enhanced/original **before-after toggle**, **Share report**
  (native Share, text summary), and a "View past scans" link.
- New `ScanHistoryScreen`: past scans with a **glow-score trend sparkline**
  (react-native-svg), tap to reopen a scan as a report, long-press to delete,
  pull-to-refresh. Registered in the Home stack; reachable from FaceGlow (history
  icon) and results.

### Mobile — Cycle 4: onboarding

- `FaceGlowScreen`: "these are general routines — scan to personalise" banner and
  a history entry point; routines section relabelled **General Routines**.

### Verification

- Backend pytest, mobile **64 jest** + tsc + eslint all green.

## [2026-06-16] — Face Analysis accuracy foundation (Cycle 1): trained-model path, recalibrated CV, capture-quality gate

Fixes untrustworthy scores (e.g. oily skin reading as *low* oiliness) and adds
capture-quality gating. Full write-up: [FACE_ANALYSIS_AI.md §12](FACE_ANALYSIS_AI.md).

### Backend — accuracy

- **Hybrid scorer.** New `app/ai/skin_model.py` — lazy ONNX Runtime singleton
  (`1×3×224×224` → `1×9`); the pipeline uses the trained model when
  `app/ai/models/skin_model.onnx` is present, else falls back to the recalibrated
  CV analyzers. `raw_metrics.scoring_method` records which ran. `onnxruntime` added
  to `requirements.txt`; model artifacts git-ignored.
- **Oiliness rewrite** (`oiliness_analyzer.py`) — replaced the fixed HSV V>220
  count (missed oily-but-not-blown-out skin) with an adaptive gloss measure
  (specular ratio vs the ROI's own mean+k·std, specular-blob density, highlight
  desaturation).
- **Colour constancy + skin-tone fairness** (`image_preprocessor.py`) —
  `normalize_white_balance` (Shades-of-Gray) neutralises lighting cast before
  colour analysis; `estimate_skin_tone` (ITA°) drives a tone baseline so
  inflammation isn't over-flagged on warmer/darker skin. Stored in
  `raw_metrics.skin_tone`.
- **Per-metric + overall confidence** in `raw_metrics.confidence` (sharpness,
  lighting, ROI availability, scoring method).

### Backend — capture-quality gate

- New `app/ai/quality.py` `assess_quality` (blur / brightness / face-count /
  face-size / centering). `POST /face-glow/scan/upload` runs it **synchronously**
  for face scans before storing; blocking issues return **422** with `reason` +
  `guidance` (`error_response` extended). `upload_service` split out
  `validate_and_upload_bytes` so the gate reuses the already-read bytes.

### Backend — ML training scaffold (run by the user)

- New `backend/ml/` project: `prepare_dataset.py` (label→metric mapping, masked
  partial labels, train/val/test split), `train.py` (multi-head MobileNetV3-Small,
  masked loss, `--smoke`), `eval.py` (MAE + Pearson/Spearman gate), `export_onnx.py`
  (→ `app/ai/models/skin_model.onnx` + parity check), `requirements-train.txt`,
  `README.md`.

### Mobile

- `api/client.js` `normalizeError` now preserves `reason`/`guidance`/`status` on
  the thrown Error; `FaceScanScreen` shows the quality-gate guidance and keeps the
  user on the camera to retake (instead of a generic error).

### Tests

- Rewrote the stale `tests/test_face_scan.py` (it asserted the removed mock-75
  scores and used an undecodable 20-byte JPEG) to exercise the real pipeline +
  quality gate; new `tests/test_ai_foundation.py` (oiliness ranking, white balance,
  ITA ordering, confidence, model-absent fallback). Backend **117 passed**; mobile
  **64 passed**, tsc + eslint clean. Added jest mocks for vision-camera/image-picker.

## [2026-06-15] — Face Analysis Sprints 2–3: upload + camera + **real AI pipeline**, error reporting, auth UI redesign

Lands the upload pipeline, mobile capture, and the **real OpenCV/MediaPipe face
analysis** (Sprints 2–3 of [FACE_ANALYSIS_SPEC.md](FACE_ANALYSIS_SPEC.md)).
Full AI write-up: **[FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)**.

### Backend — Sprint 2 (upload + persistence)

- **Migrations** `d4e5f6a7b8c9` (`face_scans`) → `e5f6a7b8c9d0` (`scan_results`)
  → `f6a7b8c9d0e1` (`scan_recommendations`); `a7b8c9d0e1f2` adds `progress_stage`
  and `landmarks_json` to `face_scans` (live progress + client mesh overlay).
- **Models + repositories:** `FaceScan`, `ScanResult`, `ScanRecommendation`;
  `FaceScanRepository` (incl. `set_status`, `set_progress`), `ScanResultRepository`,
  `ScanRecommendationRepository.bulk_create`.
- **`upload_service.py`** — MIME validation (python-magic), size gate, Cloudinary
  upload (local-disk fallback when Cloudinary unconfigured).
- **`face_scan.py` endpoint** (prefix `/face-glow`): `POST /scan/upload` (202,
  `scan_storage` consent gate → 403), `GET /scan/{id}/status`, `GET /history`,
  `DELETE /scan/{id}` — runs the pipeline as a FastAPI BackgroundTask with its
  own DB session.

### Backend — Sprint 3 (real AI pipeline)

- **`app/ai/` module:** `face_detector.py` (MediaPipe **FaceLandmarker** singleton,
  478-point mesh, auto-downloads `face_landmarker.task`), `image_preprocessor.py`
  (resize, blur via Laplacian, lighting via Lab L\*, landmark-indexed ROI extraction).
- **9 analyzers** (`app/ai/analyzers/`) — hydration, oiliness, wrinkle,
  pigmentation, dark-circle, pore, elasticity, muscle-tone, inflammation — plus
  `glow_score_engine` (weighted composite) and `toxin_indicator`. Classical CV
  (Lab/HSV stats, Canny, GLCM via scikit-image, high-pass variance, landmark
  symmetry); each returns 0–100 and fails soft to a neutral default.
- **`scan_pipeline_service.py` rewritten** to run the real pipeline: stages
  `preprocessing → detecting → analyzing → scoring → done`; analyzers run in a
  `ThreadPoolExecutor`; computes glow / toxin / skin-age / overall-wellness.
  **Graceful-degradation ladder:** MediaPipe landmarks → OpenCV Haar cascade →
  centred crop → friendly retake message (never a raw exception). Blur gate
  relaxed to <30 so phone selfies pass.
- **`recommendation_engine_service.py`** — transparent TCM rule engine (≥15 rules
  on the metric thresholds → routines + wellness tips, max 8, priority-sorted).
- **`requirements.txt`:** activated `opencv-python-headless`, `mediapipe`,
  `Pillow`, `scikit-image`, `numpy>=2`, `python-magic` (note: mediapipe/opencv/
  skimage wheels are Python ≤3.12 — the server boots without them and runs in
  OpenCV-only fallback mode).

### Backend — Error reporting

- **`error_report.py` endpoint** (`POST /api/v1/errors/report`) — accepts client
  crash/error reports for triage; registered in `router.py`. `main.py` gained
  startup wiring for the AI/scan stack.

### Mobile — capture, processing, results, errors

- **New screens:** `FaceScanScreen` (Vision Camera capture + `FaceOverlayGuide`
  oval), `ScanProcessingScreen` (polls status, shows live stage text),
  `ScanResultsScreen` (metrics + recommendations + `FaceMeshOverlay` over the
  still), `ScanErrorScreen` (actionable failure state). `scanStore.js` (Zustand);
  `scanService.js`; `MetricScoreRow`, `RecommendationCard`, `FaceMeshOverlay` components.
- **Resilience:** `ErrorBoundary` (app-wide), `ServiceUnavailable` fallback, and
  `errorReportingService` (posts to the new backend endpoint); wired in `App.tsx`.
  `api/client.js` hardened (timeouts/error normalization for the scan flow).

### Mobile — Auth UI redesign + intelligent keyboard focus

- **LoginScreen & RegisterScreen** restyled into one cohesive sheet-card design
  (decorative hero blobs, rounded logo badge, focus-highlighted inputs, arrow CTA).
- **Intelligent focus** now on **both** screens: `KeyboardAvoidingView` (iOS) +
  scroll-to-focused-field, per-field focus highlight, and `returnKeyType` chaining
  (`next`/`done`) so the keyboard never covers the active field. RegisterScreen
  previously used a no-op `KeyboardAvoidingView` on Android — fixed.
- RegisterScreen now relies on the auth-state listener for navigation (removed the
  latent `navigation.replace('Main')` — `Main` isn't in the logged-out stack);
  its jest test updated to match.

### Docs

- **New [FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)** — libraries, models, ROI map,
  per-analyzer techniques, scoring formulas, degradation ladder, TCM rules, caveats.
- **[RUNNING.md](RUNNING.md) §8** — full physical-device workflow over `adb`
  (wiring/authorisation, `adb reverse`, build & install, launch/stop/clear,
  screenshots & recording, JS-vs-native relaunch, logcat, wireless debugging).
- Updated FEATURES, TASKS (Sprints 2–3 marked done), and ARCHITECTURE.

## [2026-06-15] — M-Heal rebrand, scan reliability, UI polish, SRS audit

### Branding
- Renamed app to **M-Heal** — *AI Assisted Acupressure & Wellness App*: launcher label (`strings.xml`), `app.json` displayName, Login/Register hero, Home header, scan permission copy. Android package id `com.wellness` unchanged (cosmetic name only).

### Face Scan reliability (fixes "technical error" / "network error" on upload)
- `scan_pipeline_service.py`: relaxed blur gate `100 → 30` (phone selfies were failing the old threshold); Haar cascade now uses histogram-equalised gray + relaxed params + alt cascade; **graceful degradation** — when detection misses, analyse a centred crop instead of hard-failing; friendly user-facing error message instead of raw exception text.
- `scanService.js`: upload timeout `15s → 45s` (default was too short for image uploads on mobile networks).

### UI
- Bottom tab bar now respects the device safe-area inset (`useSafeAreaInsets`) — no longer flush against the gesture bar.
- Home page decluttered — removed the dead "Premium Wellness Plan" promo banner (no action) from the header.

### Docs
- Added **[SRS_AUDIT.md](SRS_AUDIT.md)** mapping the official `SRS_MHeal.pdf` to implementation status; updated `FEATURES.md` (Face Scan live, endpoint scoreboard 34/34). Notable gap surfaced: only 5 of 9 MVP symptoms seeded.

## [2026-06-14] — Face Analysis Sprint 1: DB Foundation + Routines DB + Consent API

Begins the 8-sprint Face & Tongue Analysis system. Full spec: [docs/FACE_ANALYSIS_SPEC.md](FACE_ANALYSIS_SPEC.md). Sprint tracker: [docs/TASKS.md §Face Analysis](TASKS.md).

### Backend

**Added**

- **T20 — Alembic migrations (3 new revisions):**
  - `a1b2c3d4e5f6` — adds `oauth_provider VARCHAR(20)` and `oauth_provider_id VARCHAR(255)` to `users`; makes `password` nullable (required for social-only accounts). Index `ix_users_oauth` on both columns.
  - `b2c3d4e5f6a7` — creates `face_glow_routines` table (key, icon, title, duration, benefits JSON, category, video_url, sort_order, is_active). Seeds all 4 existing hardcoded routines inside `upgrade()` so the mobile sees no change.
  - `c3d4e5f6a7b8` — creates `user_consents` table with full GDPR fields (consent_type, granted, granted_at, revoked_at, ip_address, user_agent, consent_version). Unique constraint on `(user_id, consent_type)`.
- **T21 — FaceGlowRoutine model + repository + service:**
  - `app/models/face_glow_routine.py` — SQLAlchemy model, `to_dict()` returns same shape as previous hardcode.
  - `app/repositories/face_glow_routine_repository.py` — `get_all(active_only=True)`, `get_by_key()`.
  - `app/services/face_glow_routine_service.py` — cache-aside pattern: Redis with 1h TTL (`face_glow_routines:all` key), falls back to DB on miss or Redis error.
- **T22 — UserConsent model + repository + service:**
  - `app/models/user_consent.py` — `ALLOWED_CONSENT_TYPES = {"scan_storage", "ai_training", "gdpr_data"}`.
  - `app/repositories/consent_repository.py` — `get_by_user()`, `upsert()` (create-or-update), `revoke_all()`, `delete_all()`.
  - `app/services/consent_service.py` — validates type against allowed set; `get_all()`, `upsert()`, `revoke()`, `has_consent()`.
- **T24 — Consent API endpoint** (`app/api/v1/endpoints/consent.py`):
  - `GET /api/v1/consent/` — returns all consent records for the authenticated user.
  - `POST /api/v1/consent/` — body: `{consent_type, granted}`; records client IP + User-Agent; creates or updates the record.
  - `DELETE /api/v1/consent/{type}` — revokes a specific consent type.
- **T25 — Config additions** (`app/core/config.py`):
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Sprint 2 image storage.
  - `GOOGLE_CLIENT_ID`, `APPLE_APP_ID` — Sprint 5 social auth.
  - `SCAN_MAX_FILE_SIZE_MB = 15`, `RATE_LIMIT_SCAN_UPLOAD = "5/minute"`.
- **T26 — requirements.txt:** activated `python-multipart>=0.0.9` and `cloudinary>=1.40.0`; Sprint 3-7 dependencies added as commented stubs.
- `.env.example` updated with Cloudinary and social auth variable examples.

**Changed**

- **T23 — face_glow.py:** replaced `_ROUTINES` hardcode list with `FaceGlowRoutineService.get_all(db)`. Both endpoints (`/routines`, `/routines/{key}`) now accept a `db: Session` dependency. Response shape is identical — zero mobile changes required.
- **T27 — db/base.py:** added imports for `FaceGlowRoutine` and `UserConsent` so Alembic's autogenerate and test fixtures see both models.
- **router.py:** registered `consent.router`.

## [2026-06-13] — P2 validation pass (test + token fixes)

Validation of the P2 batch surfaced a few defects in the just-added work; fixed:

- **T17 test suite was not actually green** (the failures were intermittent, masked by an unrelated teardown error):
  - `authService.test.js` (4 tests) asserted `AsyncStorage.setItem/removeItem` calls, but `@react-native-async-storage/async-storage` **v3**'s bundled jest mock is a real in-memory store, not `jest.fn()` spies — `toHaveBeenCalledWith` errored. Now overridden with spies in the test file.
  - `ConsultScreen.smoke.test.js` content assertions used `JSON.stringify(tree.toJSON())`, which threw *"Converting circular structure to JSON"* because the FlatList's `refreshControl` element prop carries circular fiber refs — so those assertions never ran. Replaced with a children-only text walker. Also unmount the tree after each test so the 300 ms search-debounce timer's cleanup fires (it was re-rendering after Jest teardown → the flaky `RefreshControl` "import after teardown" error).
  - Full suite now **13 suites / 64 tests, green and stable across repeated runs**; `tsc --noEmit` clean; eslint 0 errors.
- **T16 token misses**: 5 danger-semantic `#EF4444` literals (the Toast error background + the error-state icons in WellnessScreen, ReliefScreen, ReliefSessionScreen, YogaSessionScreen) now use the `COLORS.danger` token that was added for exactly this value.

## [2026-06-13] — P2 polish/platform, second batch (T16, T17 + UX/DX improvements)

### Frontend

**Added**

- **Toast/Snackbar system**: pure-RN `Animated` component (`mobile/src/components/Toast.js`) with Zustand store (`mobile/src/utils/toast.js`); auto-dismisses after 3 s; supports `success`, `error`, `warning`, `info` variants. Mounted once in `App.tsx` — any screen can call `useToastStore.getState().show(...)` (or the `showToast`/`showError`/… helpers exported from the same module).
- **SkeletonLoader component** (`mobile/src/components/SkeletonLoader.js`): pulsing `Animated` placeholder for list/card shapes; used in WellnessScreen (`StatsSkeleton`, `ProgramSkeleton`) and ReliefScreen (`CardSkeleton`). No external deps.
- **T17 — Frontend test coverage**: six service suites (`wellnessService`, `reliefService`, `consultService`, `therapyService`, `preferencesService`, `authService`) each covering happy path, error propagation, and fallback message. Three screen smoke tests (`HomeScreen`, `ConsultScreen`, `TherapyHistoryScreen`) verify render-without-crash and key content after async load. All in `mobile/src/__tests__/` using the existing `@react-native/jest-preset` + `jest.setup.js`.

**Changed**

- **T16 — Shared theme adoption (all 20 screens)**: every screen's StyleSheet and inline JSX colour props now use `COLORS`/`SPACING`/`RADIUS` tokens from `mobile/src/constants/theme.js`. Per-screen hex literals removed. `COLORS.danger` (`#EF4444`) added to the theme. Preserved intentionally: FaceGlow brand pinks (`#C850C0`, `#f3e8ff`, `#fdf4ff`), per-symptom card colours in `SelectSymptomScreen`, logout button reds in `ProfileScreen`, and contact-channel brand colours in `HelpSupportScreen`.
- **src/data/ removed**: the 8 static fallback data files (`yogaSessionData.js`, `reliefSessionData.js`, etc.) deleted; screens now use Loading Skeleton + Error Boundary patterns — no local mock data as a fallback layer.
- `WellnessScreen`, `ReliefScreen`: replaced static list renders with `StatsSkeleton`/`ProgramSkeleton`/`CardSkeleton` during the API fetch; error state shows a retry button.
- `YogaSessionScreen`, `ReliefSessionScreen`: refactored into a thin loading wrapper + player component; player only renders after the API responds (no local-data fallback).
- ESLint target in CI updated from `src App.tsx __tests__` → `src App.tsx` (tests live under `src/__tests__/`, already covered by the `src` glob).

### Tooling / Repo

- **Folder rename**: `wellness-frontend` → `mobile`, `wellness-backend` → `backend`. All CI `working-directory` and `cache-dependency-path` references updated.
- **Root `README.md`**: setup guide for both `backend` and `mobile`, including Python venv, Alembic migration, seed scripts, environment variables, test commands, and Android APK build notes.
- **CI (`ci.yml`) updated**: working directories and pip cache paths now reference `backend/` and `mobile/`; ESLint path corrected.

---

## [2026-06-12] — P2 polish/platform, first batch (TASKS.md T12, T15, T18, T19)

### Backend

**Added**

- **T15 — Notification preferences**: new `UserPreference` model + migration (`e6f3a82d4c91`) — one row per user with a `push_enabled` master switch and a JSON `notifications` dict keyed by the apps' toggle ids (new toggles need no migration). `GET /api/v1/users/me/preferences` (auth; defaults created on first read) and `PUT` (auth; partial update — the notifications dict merges with stored values, non-bool values rejected 400). Per-user isolation tested; account deletion cascades the row. Tests: 79 → **84**.

### Frontend

**Fixed**

- **T18 — HomeScreen empty labels**: the 10 `<Text>` elements emptied by PR #1 (title, subtitle, banner, Wellness/See All, Face Glow card, consult banner) now render the `STRINGS` constants that already existed for them.

**Changed**

- **T12 — Home wellness rows from API**: HomeScreen now loads the wellness rows from the T7 `GET /sessions` catalog (first 3 by sort order — "See All" opens the Wellness tab), mapping session keys to MaterialCommunityIcons names (`WELLNESS_ROW_ICONS`); quick-relief and wellness fetches run in parallel; the hardcoded list remains as the offline fallback.
- **T15 — Preference toggles persisted**: SettingsScreen's notification toggles and NotificationsScreen's master + 9 granular toggles hydrate from the server on mount and save optimistically on change via the new `src/services/preferencesService.js`. Both screens share toggle ids (e.g. SettingsScreen "Promotional Emails" ↔ NotificationsScreen "Offers & Deals" = `offers`). Push *delivery* (FCM / expo-notifications) is still open.

### Tooling

- **T19 — CI**: `.github/workflows/ci.yml` — on PRs and pushes to main, runs backend pytest (Python 3.13, pip cache) and frontend jest + `tsc --noEmit` + eslint (Node 22, npm ci).

Remaining P2 (next session): T13 Face Glow backend, T14 subscriptions (billing provider decision pending), T16 theme-token migration, T17 frontend service/screen test coverage, plus the react-native-razorpay checkout for real keys.

## [2026-06-12] — P1 feature completeness (TASKS.md T6–T11)

### Backend

**Added**

- **T6 — Doctor filter endpoints**: `GET /api/v1/doctors/available-today`, `/video-call`, `/home-visit`, `/top-rated` — same paginated card shape (+ `search`) as the catalog. available-today filters `is_available_today`; video/home join the `consultation_types` m2m; top-rated = `average_rating >= 4.5` ordered desc. Registered **before** `/doctors/{id}` (FastAPI path-converter ordering). `seed.py` now links consultation types to the demo doctors (the filters were unseedable before).
- **T7 — Session catalogs**: new `WellnessSession` + `ReliefSession` models (key, title, duration label, icon, video URL, total cycles, steps JSON, sort order, is_active) + migration (`b7c1f4e92d35`). `GET /api/v1/sessions[/:key]` and `GET /api/v1/relief-sessions[/:key]` return the exact player shape the screens consume; 404 envelope on unknown keys. Seed content ported from the frontend mock files into `seed_data.py` (6 wellness + 10 relief sessions).
- **T8 — Profile management**: `PUT /api/v1/auth/me` (full_name/avatar_url), `POST /api/v1/auth/change-password` (verifies current password — 401 on mismatch — then **revokes every previously issued token** and returns a fresh pair), `DELETE /api/v1/auth/me` (hard delete + explicit cascade of therapy sessions, payments and appointments; doctor accounts refused with 400). Token revocation works via a new `users.token_version` column (migration `c4d8a61f7b29`) carried in JWTs as `ver` and checked on every authed request — also makes deleted users' tokens die immediately. `GET /auth/me` now returns the full user profile alongside `user_id`.
- **T11 — Payments (Razorpay sandbox)**: new `Payment` model + migration (`d9e2b53a8c47`, also adds `appointments.payment_status` unpaid/paid). `POST /api/v1/payments/process` (auth) creates an order — against the Razorpay REST API when `RAZORPAY_KEY_ID/SECRET` are set (test keys = sandbox), otherwise in a keyless **local sandbox mode** that also returns a valid `sandboxPaymentId`/`sandboxSignature` pair so the flow completes without the native checkout SDK. `POST /api/v1/payments/verify` checks the Razorpay HMAC-SHA256 signature (`order_id|payment_id`): success marks payment + appointment paid; mismatch marks the payment failed and leaves the appointment unpaid. Ownership enforced; double payment refused.
- Tests: 52 → **79** (filters, session catalogs, profile update / password change / token revocation / account deletion, payment process/verify/tamper/auth/ownership).

### Frontend

**Added**

- **T9 — RegisterScreen**: full name / email / password + confirm, client-side validation, calls `POST /auth/register` then auto-logs in (`authService.register`) and lands on Main. Linked from LoginScreen ("Sign Up") and added to the RootStack. 4 jest tests.
- **T10 — Axios auto-refresh on 401** (`src/api/client.js`): response interceptor exchanges the keychain refresh token for a new access token on any 401 (except login/register/refresh/logout), replays the original request, and queues concurrent 401s behind a single refresh. On refresh failure: tokens + cached user cleared, Zustand store reset, navigation reset to Login via the new `src/navigation/navigationRef.js` (attached to NavigationContainer in App.tsx). 5 adapter-driven jest tests.
- `authService`: new `register`, `updateProfile`, `changePassword` (stores the rotated token pair), `deleteAccount` methods.

**Changed**

- **T8 — SettingsScreen wired**: Edit Profile and Change Password now work via in-screen modal forms; the email row shows the logged-in user's email; Logout actually logs out (server-side revoke + reset to Login); Delete Account calls `DELETE /auth/me` and resets to Login.
- **T11 — PaymentScreen wired**: Pay now runs order create → verify against the backend (no more fake success alert); failures surface as a Payment Failed alert. `appointmentId` is threaded through Book → BookingConfirmed → Payment so a verified payment marks that appointment paid. With real Razorpay keys the checkout SDK step is still TODO (native module — needs an Android SDK machine).
- T6 note: ConsultScreen's filter tabs were already calling the new endpoints (`FILTER_ENDPOINT_MAP`) — they now return server-filtered data instead of erroring into the fallback.
- T7 note: the wellness/relief players now run from API content; the local `yogaSessionData.js`/`reliefSessionData.js` files are kept (deliberately, vs. the original "delete mocks" wording) as instant-render/offline fallbacks since the screens initialize timer state synchronously before the fetch resolves.

## [2026-06-12] — P0 booking funnel + therapy history (TASKS.md T1–T5)

### Backend

**Added**

- **T1 — Doctor detail**: `GET /api/v1/doctors/:id` returning the same card shape as the list (serializer extracted to `doctor_card()` in `endpoints/doctors.py`, shared by both); 404 envelope when missing.
- **T2 — Visit types**: `GET /api/v1/doctors/:id/visit-types` derived from the `consultation_types` m2m. Presentation metadata (slug/title/subtitle/icon) lives in `app/services/doctor_service.py` (`VISIT_TYPE_PRESENTATION`); fee comes from `doctors.consultation_fee`.
- **T3 — Time slots**: `GET /api/v1/doctors/:id/time-slots?date=YYYY-MM-DD` generates slots from `doctor_availability` (day-of-week window ÷ `slot_duration_minutes`), minus already-booked non-cancelled appointments. 400 on malformed/past dates. `seed.py` now seeds Mon–Sat 09:00–12:00 + 14:00–17:00 (30-min) availability per doctor.
- **T4 — Appointment booking**: new `Appointment` model + migration (`f3a9c2d41b07`) with user/doctor/consultation-type FKs, date, slot start/end, fee, status (booked/cancelled/completed). `POST /api/v1/appointments/book` (auth) — 409 envelope when the doctor already has a non-cancelled appointment for the same date+slot; 404 unknown doctor; 400 past date / bad time. `GET /api/v1/appointments` (auth) — user's bookings newest first with `isUpcoming` flag. Booking reference (`APT-NNNNNN`) derived from the row id.
- **T5 — Therapy history**: new `TherapySession` model + migration (`9d4e7b21c8aa`). `POST /api/v1/therapy-history/save` (auth) accepts the exact payload the session screens already send (`title`, `type`, ISO `date`, `'15 min'` duration, `painBefore/After`). `GET /api/v1/therapy-history` (auth, paginated, newest first) returns display-ready sessions + aggregate stats (`sessions`, `minutes`, `avgRelief` — completed sessions only).
- Tests: 25 → **52** (doctor detail/visit-types/time-slots, booking happy/conflict/auth/validation + slot exclusion + per-user isolation, therapy save/list/stats/pagination/auth). Migration chain verified against a scratch SQLite DB.

### Frontend

**Changed**

- `BookAppointmentScreen`: booking now actually books — navigates to `BookingConfirmed` only on API success (passing the new `bookingRef`), shows an alert on failure (e.g. slot conflict). Visit-type selection re-syncs to server data; time-slot list now reflects empty days instead of keeping stale defaults; changing date clears the selected time.
- `BookingConfirmedScreen`: displays the booking reference when present.
- `TherapyHistoryScreen`: wired to `GET /therapy-history` (loading/error/empty states); mock `therapyData` no longer used by the screen. Completed yoga/relief sessions now persist and appear here.

## [2026-06-12] — Frontend: RN 0.85 + Expo SDK 56, env-driven config, restructure

### React Native 0.84.1 → 0.85.3 + Expo SDK 56

- **Why:** Expo skipped RN 0.84 entirely (SDK 55 pairs with RN 0.83, SDK 56 with RN 0.85), so `install-expo-modules` could never work on 0.84. Upgrading to 0.85.3 unblocked it.
- Upgraded `react-native@0.85.3`, all `@react-native/*` packages, added `@react-native/jest-preset` (new template preset), Gradle distribution 9.0 → 9.3.1, `gem 'nkf'` (Gemfile).
- `npx install-expo-modules` succeeded: `expo@~56.0.0`, `babel-preset-expo`, `expo/metro-config`, Expo wiring in `MainApplication.kt`/`MainActivity.kt`/`AppDelegate.swift`/gradle.
- **Fixed install-expo-modules bug:** it inserted the `import expo.modules...` lines *above* the `package` declaration in both Kotlin files (syntax error) — reordered.
- **Verified:** jest 6/6, `tsc` clean, `eslint --quiet` clean, release Metro bundle builds. Native (gradle) build not verifiable on this machine — no Android SDK installed (see docs/TASKS.md → Environment notes).

### Env-driven configuration (no more hardcoded IP/port)

- New `src/config/index.js`: `BASE_URL` from `EXPO_PUBLIC_API_URL` (inlined at bundle time by babel-preset-expo) with `http://10.0.2.2:5000` fallback; `apiEndpoints.js` now imports it.
- Added `wellness-frontend/.env.example`; `.env` is gitignored. Verified by bundling with a custom URL and confirming inlining + dead-code elimination of the fallback.

### Restructure / cleanup

- New `src/constants/theme.js` — canonical COLORS/SPACING/RADIUS tokens (App.tsx tab bar migrated as first consumer; screen-by-screen adoption is task T16).
- Deleted dead code: `src/components/BottomNav.js` (unreferenced) and 7 unused `src/data/*.json` twins of the `.js` mock files.
- Removed leftover debug `console.log`s in HomeScreen; fixed the 2 pre-existing `react-hooks/exhaustive-deps` errors in BookAppointmentScreen (missing `doctor.id`).
- Added `docs/TASKS.md` — detailed, prioritized backlog of all gap features (T1–T19).

## [2026-06-12] — Tech debt: rate limiting, Redis, secure token storage, API docs

### Backend

**Added**

- **Rate limiting on auth** (`slowapi`): `POST /auth/login` (5/min), `/auth/register` (3/min), `/auth/refresh` (10/min) — per client IP, configurable via `RATE_LIMIT_*` env vars, returns 429 with the standard error envelope. New `app/core/limiter.py`; 3 new tests (`tests/test_rate_limit.py`); limiter disabled in the regular test fixtures.
- **Optional Redis** (`REDIS_URL`, off by default): when set, rate-limit counters are shared across workers and revoked-token (`jti`) lookups are served from a Redis cache (TTL = refresh-token lifetime) before falling back to the DB. The DB remains the source of truth; Redis errors degrade gracefully. New `app/core/cache.py`.
- **OpenAPI docs enrichment**: API description (envelope contract, auth model, rate limits), tag descriptions, and per-endpoint summaries — visible at `/apidocs` and `/redoc`. App version bumped to 2.1.0.

**Changed**

- **CORS origins are now settings-driven** (`CORS_ORIGINS`, comma-separated). Default remains `*` for dev; set explicit origins in production (`.env.example` documents this).
- Dependencies: + `slowapi`, + `redis`.

### Frontend

**Changed**

- **Tokens moved from AsyncStorage to the device keystore** via `react-native-keychain` (new `src/utils/secureStorage.js`, with in-memory caching so the axios interceptor doesn't hit the native keystore per request). User profile JSON stays in AsyncStorage (not a secret). One-time migration moves legacy AsyncStorage tokens into the keystore on app start.
- `App.tsx` now calls `authService.bootstrap()` on mount — it was defined but never invoked, so persisted sessions were never restored into the Zustand store (and the token migration needs it).

**Fixed**

- `authService` used `AsyncStorage.multiSet`/`multiRemove`, which **do not exist in `@react-native-async-storage/async-storage` v3** (API is now `setMany`/`getMany`/`removeMany`) — token/user persistence on login would have thrown at runtime.
- **Jest suite now runs**: `transformIgnorePatterns` allows the `@react-navigation`/RN ESM packages and `jest.setup.js` mocks the keychain + async-storage native modules. The template `App.test.tsx` failed to even parse before. Added `__tests__/secureStorage.test.js` (5 tests). 2 suites / 6 tests passing.

## [2026-06-12] — Backend migration: Flask → FastAPI + frontend infrastructure

### Backend — Migrated from Flask to FastAPI

**Replaced**

| Before (Flask) | After (FastAPI) |
|---|---|
| Flask 3.1 + Werkzeug (WSGI, sync) | FastAPI + Uvicorn (ASGI, async-capable) |
| Flask-JWT-Extended | PyJWT via `app/core/security.py` (access + refresh tokens, jti revocation) |
| Marshmallow validators | Pydantic v2 schemas (`app/schemas/`) |
| Flasgger (manual Swagger YAML in docstrings) | Built-in OpenAPI — auto-generated docs at `/apidocs`, `/redoc` |
| Flask-SQLAlchemy (`db.Model`, global `db.session`) | Plain SQLAlchemy 2.0 (`DeclarativeBase`, session via DI) |
| Flask-Migrate (`migrations/`) | Plain Alembic (`alembic/` + `alembic.ini`); all 4 existing revisions preserved |
| `controllers/` + `routes/` (two layers) | `api/v1/endpoints/` (single layer, FastAPI routers) |
| `middlewares/role_middleware.py` decorator | `require_role()` dependency in `api/deps.py` |
| `extensions/` (db, jwt init) | `db/session.py` + `core/security.py` |
| `config/config.py` (os.getenv) | `core/config.py` (pydantic-settings, typed, .env-driven) |

**Unchanged (intentionally — zero frontend impact)**

- All endpoint paths: `/api/v1/auth/*`, `/api/v1/doctors`, `/api/v1/home/quick-relief`
- All response shapes: `{"success", "message", "data"}` envelope, doctor card JSON, quick-relief `{"data": [...]}`
- All database tables and the 4 Alembic migration revisions
- Server port (5000)
- Layered architecture: endpoints → services → repositories → models

**Added**

- CORS middleware (was missing entirely in Flask)
- `GET /health` health check endpoint
- Test suite: 22 tests (auth, doctors, home) running against in-memory SQLite — `pytest`
- SQLite fallback for local development (no PostgreSQL required to boot)
- Validation errors now return 400 with field-level messages (matches old Marshmallow behavior, not FastAPI's default 422)

**Fixed**

- `seed.py` stored doctor passwords as **plaintext** — now bcrypt-hashed
- Removed debug `print()` statements from auth service
- Removed pointless `User.__init__` override

**Removed**

- `app/controllers/`, `app/routes/`, `app/extensions/`, `app/middlewares/`, `app/validators/`, `app/config/` folders
- `app/utils/password.py`, `app/utils/response.py`, `app/utils/error_handler.py` (consolidated into `core/security.py` and `utils/responses.py`)
- `migrations/` (Flask-Migrate) — replaced by `alembic/`
- Dependencies: Flask, Flask-SQLAlchemy, Flask-JWT-Extended, Flask-Migrate, Flasgger, Marshmallow, Werkzeug, Jinja2, blinker, itsdangerous

### Frontend — Infrastructure only (no feature/UI changes)

**Added**

- `axios` — replaces the custom fetch-based `httpInterceptor`
  - New client: `src/api/client.js` (same call surface: `get/post/put/delete` resolving to parsed body, Bearer token injection, friendly status-code errors, 15 s timeout, network-error message)
  - All 5 services + HomeScreen rewired; `src/interceptors/` deleted
- `zustand` — global state foundation
  - New store: `src/store/authStore.js` (user, isLoggedIn, setAuth/clearAuth)
  - `authService` syncs the store on login/logout; new `bootstrap()` restores persisted session
- `src/constants/strings.js` — was imported by HomeScreen but **missing entirely (crash on startup)**
- Endpoint constants: `REGISTER`, `LOGOUT`, `REFRESH`, `ME`

**Fixed**

- `authService.logout()` now revokes the refresh token server-side (`POST /api/v1/auth/logout`) before clearing local storage — previously tokens stayed valid for 30 days after logout
- Removed all debug `console.log` statements from `authService`

**Attempted, blocked**

- Expo modules (bare workflow): `npx install-expo-modules` fails with *"Unable to find compatible Expo SDK version — reactNativeVersion 0.84.1"*. No released Expo SDK supports RN 0.84 yet. Revisit when a compatible SDK ships, or use `react-native-keychain` for secure token storage in the meantime (works on any RN version).

### Documentation

- Added `docs/CHANGELOG.md` (this file), `docs/ARCHITECTURE.md`, `docs/FEATURES.md`
- Removed superseded docs: `AUDIT.md`, `GAPS.md`, `STACK_RECOMMENDATION.md` (content absorbed into the new docs)
- Rewrote `wellness-backend/README.md` for the FastAPI stack

---

## [2026-06-12] — PR #1: Doctor details backend (`AdditionCode_11June2026_SP`)

- Added doctor module: `Doctor`, `Specialty`, `Clinic`, `DoctorAvailability`, `Award`, `Expertise`, `Language`, `ConsultationType` models + 3 association tables
- Added `QuickRelief` model and `GET /api/v1/home/quick-relief`
- Added `GET /api/v1/doctors` (pagination + name search)
- Added `avatar_url` to `User`
- Added `seed.py` with 3 demo doctors
- Frontend: `BASE_URL` set to `http://10.0.2.2:5000`; HomeScreen fetches quick relief from API

## [2026-05-28] — Initial release

- Flask backend with JWT auth (register, login, logout, refresh, me, admin dashboard)
- React Native 0.84 frontend: 17 screens, 5 service layers, navigation, mock data fallbacks
