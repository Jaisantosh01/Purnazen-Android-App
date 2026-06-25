# Task Backlog — Gap Features

**Last updated:** 2026-06-16 (Face Analysis **Sprints 1–4 complete** — T20–T39 done except T37 deferred; real tongue analysis + dashboard/trends/compare live; plus the **Consent UI** slice of T41. **Cycle 5** shipped 2026-06-16: separate Tongue Scan screen, MediaPipe-primary quality gate (fixes empty-wall false-pass) + tongue quality checks, `quality-preview` endpoint with live in-viewfinder hints, background-removed/cropped display enhancement, cropped+zoomed mesh preview, and **app rebrand to "Purnazen"** + new icon. Earlier accuracy/UX work (all-metric CV calibration, animated processing screen, enhanced preview, reports/history, TCM combination rules) shipped 2026-06-16 — see CHANGELOG. AI write-up: [FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)). P0 T1–T5, P1 T6–T11, P2 T12/T15/T16/T17/T18/T19 **all completed** — see CHANGELOG; T13/T14 deferred pending backend decisions. Derived from the FEATURES.md scoreboard plus frontend work. Conventions for backend tasks: model → import in `db/base.py` → `alembic revision --autogenerate` → schema → repository → service → endpoint → `router.py` → tests (see ARCHITECTURE.md).

---

## Face Analysis — 8-Sprint Plan

**Full spec:** [FACE_ANALYSIS_SPEC.md](FACE_ANALYSIS_SPEC.md)

### ✅ Sprint 1 — Weeks 1-2: DB Foundation + Routines DB + Consent API (2026-06-14)

#### ✅ T20. Alembic migrations: OAuth fields, face_glow_routines, user_consents
- Migrations `a1b2c3d4e5f6` → `b2c3d4e5f6a7` → `c3d4e5f6a7b8` written and chained from `e6f3a82d4c91`
- OAuth: `oauth_provider`, `oauth_provider_id` columns on `users`; `password` made nullable
- `face_glow_routines` table with inline seed of 4 existing routines
- `user_consents` table with GDPR fields (`consent_type`, `granted`, `granted_at`, `revoked_at`, `ip_address`, `consent_version`)

#### ✅ T21. FaceGlowRoutine model + repository + service
- Model: `backend/app/models/face_glow_routine.py`
- Repository: `backend/app/repositories/face_glow_routine_repository.py` — `get_all()`, `get_by_key()`
- Service: `backend/app/services/face_glow_routine_service.py` — cache-aside (Redis 1h TTL, falls back to DB)

#### ✅ T22. UserConsent model + repository + service
- Model: `backend/app/models/user_consent.py` — `ALLOWED_CONSENT_TYPES = {scan_storage, ai_training, gdpr_data}`
- Repository: `backend/app/repositories/consent_repository.py` — `upsert()`, `revoke_all()`, `delete_all()`
- Service: `backend/app/services/consent_service.py` — validates type, lifecycle management

#### ✅ T23. Migrate face_glow.py hardcode → DB
- `GET /face-glow/routines` and `/routines/{key}` now read from `face_glow_routines` table via `FaceGlowRoutineService`
- Response shape identical to previous hardcode — zero mobile changes needed

#### ✅ T24. Consent API endpoint
- `backend/app/api/v1/endpoints/consent.py` — `GET /`, `POST /`, `DELETE /{type}`
- Registered in `router.py`
- Records client IP and User-Agent on each grant

#### ✅ T25. Config: Cloudinary + social auth env vars
- `config.py`: `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`, `GOOGLE_CLIENT_ID`, `APPLE_APP_ID`, `SCAN_MAX_FILE_SIZE_MB`, `RATE_LIMIT_SCAN_UPLOAD`
- `.env.example` updated with commented examples

#### ✅ T26. requirements.txt: python-multipart + cloudinary
- `python-multipart>=0.0.9` (active)
- `cloudinary>=1.40.0` (active)
- Sprint 3-7 dependencies added as commented stubs

#### ✅ T27. db/base.py model registration
- `FaceGlowRoutine` and `UserConsent` imported so Alembic sees them

**Sprint 1 verification:**
- [ ] Run `alembic upgrade head` — applies 3 new migrations cleanly
- [ ] `GET /api/v1/face-glow/routines` → 4 routines from DB
- [ ] `POST /api/v1/consent/` `{"consent_type": "scan_storage", "granted": true}` → 200
- [ ] `GET /api/v1/consent/` → lists it
- [ ] `DELETE /api/v1/consent/scan_storage` → 200, `granted: false`

---

### ✅ Sprint 2 — Weeks 3-4: Upload Pipeline + Mobile Camera (2026-06-15)

#### ✅ T28. Alembic migrations: face_scans, scan_results, scan_recommendations
- Migrations `d4e5f6a7b8c9` → `e5f6a7b8c9d0` → `f6a7b8c9d0e1` written and chained
- `a7b8c9d0e1f2` adds `progress_stage` + `landmarks_json` to `face_scans` (live progress + client mesh overlay)
- See [FACE_ANALYSIS_SPEC.md §3](FACE_ANALYSIS_SPEC.md) for full schemas

#### ✅ T29. Models + repositories: FaceScan, ScanResult, ScanRecommendation
- `backend/app/models/face_scan.py` — relationships to ScanResult, ScanRecommendation; `progress_stage`, `landmarks_json`, `face_detected`, `face_confidence`, `blur_score`, `lighting_quality`
- `backend/app/repositories/face_scan_repository.py` — `create()`, `get_by_id()`, `get_by_user()`, `set_status()`, `set_progress()`, `delete()`
- `backend/app/repositories/scan_result_repository.py`
- `backend/app/repositories/scan_recommendation_repository.py` — `bulk_create()`

#### ✅ T30. Upload service + pipeline entry point
- `backend/app/services/upload_service.py` — MIME validate (python-magic), size check, Cloudinary upload (local-disk fallback when unconfigured)
- `backend/app/services/scan_pipeline_service.py` — `run_scan_pipeline()` BackgroundTask entry point (own `SessionLocal()`); real AI landed in T35
- BackgroundTask pattern: task creates own `SessionLocal()` (request session is closed by then)

#### ✅ T31. face_scan.py endpoint
- `backend/app/api/v1/endpoints/face_scan.py` (prefix `/face-glow`)
- `POST /face-glow/scan/upload` (202, consent gate — 403 if no scan_storage consent)
- `GET /face-glow/scan/{id}/status`, `GET /face-glow/history`, `DELETE /face-glow/scan/{id}`
- Registered in `router.py`

#### ✅ T32. Mobile: Vision Camera + capture screens
- `react-native-vision-camera`, `react-native-image-resizer`, `react-native-svg` in `package.json`
- `FaceScanScreen.js`, `ScanProcessingScreen.js` (polls status + live stage text), `ScanResultsScreen.js`, `ScanErrorScreen.js`
- `scanService.js`, `scanStore.js` (Zustand)
- `MetricScoreRow.js`, `RecommendationCard.js`, `FaceOverlayGuide.js`, `FaceMeshOverlay.js` components
- Screens wired into `App.tsx`

---

### ✅ Sprint 3 — Weeks 5-6: Real AI Pipeline (Face) (2026-06-15)

> Full implementation write-up: **[FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)**.

#### ✅ T33. AI module structure
- `backend/app/ai/` created
- `face_detector.py` — MediaPipe FaceLandmarker singleton (478-pt mesh, auto-downloads `face_landmarker.task`); Haar-cascade fallback path
- `image_preprocessor.py` — `resize_for_analysis`, `detect_blur` (Laplacian), `detect_lighting` (Lab L\*), `extract_rois` (landmark-indexed)

#### ✅ T34. 9 skin analyzers
- `analyzers/hydration_analyzer.py` — Lab L* + GLCM homogeneity on cheek ROI
- `analyzers/oiliness_analyzer.py` — HSV high-V (specular) pixel ratio on T-zone
- `analyzers/wrinkle_analyzer.py` — Canny edge density + GLCM contrast, forehead/eye corners
- `analyzers/pigmentation_analyzer.py` — Lab a*/b* std-dev across HSV skin mask
- `analyzers/dark_circle_analyzer.py` — Lab L* under-eye vs. cheek baseline delta
- `analyzers/pore_analyzer.py` — high-pass (image − Gaussian) variance on cheeks
- `analyzers/elasticity_analyzer.py` — GLCM energy on jawline/forehead
- `analyzers/muscle_tone_analyzer.py` — bilateral landmark symmetry about the nose axis
- `analyzers/inflammation_analyzer.py` — Lab mean a* (redness)
- `analyzers/glow_score_engine.py` — weighted composite (spec §4)
- `analyzers/toxin_indicator.py` — dark_circle + oiliness + (100 − glow)

#### ✅ T35. Wire real AI into scan pipeline + TCM recommendation engine
- `scan_pipeline_service.py` runs real analyzers in a `ThreadPoolExecutor`; stages `preprocessing→detecting→analyzing→scoring→done`; computes glow/toxin/skin-age/overall-wellness; **graceful-degradation ladder** (MediaPipe → Haar → centred crop → friendly retake message)
- `recommendation_engine_service.py` — ≥15 TCM rules → routines + tips (max 8, priority-sorted)
- Python deps activated: `opencv-python-headless`, `mediapipe`, `Pillow`, `scikit-image`, `python-magic`, `numpy>=2`
- Note: mediapipe/opencv/skimage wheels are Python ≤3.12; server boots without them and runs OpenCV-only fallback
- Remaining: formal pytest matrix across lighting / skin tones / angles (→ T43)

---

### ✅ Sprint 4 — Weeks 7-8: Tongue Analysis + Dashboard/Trends (2026-06-16) — T37 deferred

#### ✅ T36. Tongue pipeline
- `backend/app/ai/tongue/segmenter.py` — GrabCut isolation (reddish-mask refine, ellipse fallback)
- `backend/app/ai/tongue/color_analyzer.py` — Lab/HSV classification of TCM dimensions
- `backend/app/ai/tongue/tcm_rules.py` — markers → wellness score; `tongue/__init__.py` `analyze()` orchestrator
- Wired into `scan_pipeline_service` (replaces the tongue mock); existing recommendation-engine tongue rules now fire on real markers

#### ⏳ T37. scan_notifications table + notification records — DEFERRED
- Low value until push delivery (FCM) exists, which is also unbuilt. Revisit with Sprint 7/notifications work. (Note: `a7b8c9d0e1f2` was already used for face-scan progress/landmark columns.)

#### ✅ T38. Dashboard + trends + comparison endpoints
- `scan_dashboard_service.py` — latest scores, 7-day rolling glow, glow trend; `ScanResultRepository.get_user_results`
- `GET /face-glow/dashboard`, `GET /face-glow/trends?metric=&days=`, `POST /face-glow/scan/{id}/compare`
- Tests: `tests/test_scan_dashboard.py`

#### ✅ T39. Mobile: tongue scan + history + dashboard + comparison screens
- Tongue scan reuses the capture flow (`scanType:'tongue'`) — entry from FaceGlow + dashboard
- `ScanHistoryScreen.js` (done earlier), `ScanDashboardScreen.js`, `ScanComparisonScreen.js`
- `components/scan/TrendChart.js` (react-native-svg — no chart-kit dependency needed)

---

### Sprint 5 — Weeks 9-10: Social Auth + Consent UI

#### T40. Social auth backend
- Add `google-auth`, `cryptography` to requirements
- `social_auth_service.py` — Google JWKS validation + Apple identity token validation
- `social_auth.py` endpoint (`POST /auth/social/google`, `POST /auth/social/apple`)
- `UserRepository`: add `find_by_oauth()`, `create_oauth_user()`, `link_oauth_to_existing()`
- `auth_service.login()`: guard against `user.password is None` for social-only users
- `auth_service.delete_account()`: cascade-delete all scan data + consents

#### ⚠️ T41. Mobile: social auth + consent UI — Consent UI DONE (2026-06-16); social auth deferred
- ✅ `ConsentScreen.js` (Settings → "Privacy & Data Consent") + `consentService.js` — toggles for scan_storage / ai_training / gdpr_data against the existing consent API
- ✅ Consent gate already present in `FaceScanScreen.js` (403 → grant prompt)
- ⏳ Google/Apple sign-in deferred — needs `@react-native-google-signin/google-signin`, real OAuth client IDs, and the backend `social_auth_service` (T40); not verifiable without credentials
- ⏳ `socialAuthService.js` + Google button in `LoginScreen.js` (with T40)

---

### Sprint 6 — Weeks 11-12: Security, Performance & Polish

#### T42. Security hardening
- Rate limit scan upload: `5/minute` per user (already in config; wire into endpoint)
- Cloudinary signed URL delivery (authenticated; not public)
- `POST /face-glow/data` — GDPR: delete all scans + revoke all consents
- Server-side JPEG recompression before Cloudinary upload (Pillow quality=85)

#### T43. Testing
- pytest suite for all 9 analyzers with fixture images
- API integration tests for all new endpoints (upload, status, history, delete, dashboard, trends)

#### T44. Mobile polish
- Upload progress bar; proper error states; `GlowScoreGauge.js` (animated SVG arc)
- Share button (`react-native-view-shot`); deletion confirmation dialog
- `ScanHistorySkeleton` added to `SkeletonLoader.js`

---

### Sprint 7 — Weeks 13-14: Celery + Production Infrastructure

#### T45. Celery async task queue
- Add `celery>=5.4.0` to requirements
- `backend/app/worker/celery_app.py`, `backend/app/worker/tasks.py`
- Switch `face_scan.py` from `background_tasks.add_task()` to `process_scan.delay()`
- Add `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND` to `config.py`
- `Dockerfile.worker` for the Celery worker service

#### T46. Monitoring + observability
- Add `sentry-sdk[fastapi]` for error tracking
- Structured JSON logging across the pipeline (step timing)
- `GET /health/detailed` — checks DB, Redis, and Cloudinary connectivity
- Flower monitoring dashboard configuration

---

### Sprint 8 — Weeks 15-16: Premium + Analytics + Final QA

#### T47. Analytics events
- `analytics_events` table: `{user_id, event_type, scan_id, metadata, created_at}`
- Emit events: `scan_started`, `scan_completed`, `scan_failed`, `recommendation_clicked`
- `GET /admin/analytics` — admin role-gated aggregate counts

#### T48. Premium gate
- Gate comparison and extended trend features behind `is_premium` user field
- Mobile: "Upgrade to Premium" stub screen for gated features

#### T49. Final QA
- Load test: 100 concurrent scan uploads, measure P95 latency
- End-to-end test on physical Android device (minSdk 24)
- Full UX pass: empty states, error states, skeleton loaders across all 7 new screens

---

P0 implementation notes (2026-06-12): visit-type slugs `video`/`home`/`clinic` map to the `consultation_types` lookup names in `app/services/doctor_service.py` (`VISIT_TYPE_PRESENTATION`); booking conflict check is app-level (no partial unique index); seed adds Mon–Sat 09–12 & 14–17 availability (30-min slots) per doctor; therapy stats = completed sessions only, `avgRelief = round(avg(painAfter − painBefore))`.

P1 implementation notes (2026-06-12): filter routes are registered before `/doctors/{id}` (path-converter ordering); T7 keeps the frontend mock data files as offline/instant-render fallbacks (screens init timer state synchronously) — API content wins once fetched; T8 token revocation = `users.token_version` ↔ JWT `ver` claim (also kills deleted users' tokens); T10 resets to Login through `src/navigation/navigationRef.js`; T11 runs keyless in a **local sandbox mode** (backend returns `sandboxPaymentId`/`sandboxSignature`; verify path identical to live) — the react-native-razorpay checkout for real keys is still open (native module, needs an Android SDK machine).

---

## P0 — Blocks core UX (the booking funnel) — ✅ ALL DONE 2026-06-12

### ✅ T1. Doctor detail endpoint
- **Backend:** `GET /api/v1/doctors/:id` returning the same card shape as the list endpoint (single object, 404 envelope when missing). No new model — `DoctorRepository.get_by_id` + service + endpoint.
- **Frontend:** `consultService.getDoctorDetail(id)` already calls `ENDPOINTS.DOCTOR_DETAIL(id)` with a mock fallback — verify shape matches, then remove fallback.
- **Accept:** DoctorProfileScreen renders live data; tests for 200 + 404.

### ✅ T2. Visit types endpoint
- **Backend:** `GET /api/v1/doctors/:id/visit-types` from the existing `consultation_types` m2m (id, name, fee/duration if modeled; else derive fee from `doctors.consultation_fee`).
- **Frontend:** BookAppointmentScreen already fetches via `consultService.getVisitTypes(doctor.id)` and falls back to `DEFAULT_VISIT_TYPES`.
- **Accept:** Visit-type chips reflect DB rows; test covers doctor with/without types.

### ✅ T3. Time slots + slot generation
- **Backend:** `GET /api/v1/doctors/:id/time-slots?date=YYYY-MM-DD`. Generate slots from `doctor_availability` (day-of-week, start/end, slot_duration), minus already-booked appointments (depends on T4 model; until then return all generated slots). Validate date ≥ today.
- **Frontend:** already wired with fallback (`consultService.getTimeSlots`).
- **Accept:** Slots match seeded availability; booked slots excluded once T4 lands; tests for empty day, invalid date.

### ✅ T4. Appointment booking
- **Backend:** new `Appointment` model (user FK, doctor FK, consultation_type FK, date, slot start/end, status: booked/cancelled/completed, created_at) + migration. `POST /api/v1/appointments/book` (auth required) with conflict check (unique doctor+date+slot among non-cancelled), `GET /api/v1/appointments` (user's upcoming/past). Seed statuses.
- **Frontend:** BookAppointmentScreen → BookingConfirmedScreen currently navigates without calling anything; wire `consultService.bookAppointment(payload)`; pass booking ref to the confirmation screen.
- **Accept:** Double-booking a slot returns 409-style envelope; booking appears in `GET /appointments`; tests for happy path, conflict, unauthenticated.

### ✅ T5. Therapy history (save + list)
- **Backend:** new `TherapySession` model (user FK, session_key, session_type yoga/meditation/breathing/acupressure, duration_seconds, completed_at) + migration. `POST /api/v1/therapy-history/save` (auth), `GET /api/v1/therapy-history` (auth, newest first, paginated).
- **Frontend:** YogaSessionScreen/ReliefSessionScreen already call `therapyService.saveSession(...)` on completion (currently silently lost); TherapyHistoryScreen shows mock — wire list.
- **Accept:** Completing a session persists it and it appears in TherapyHistoryScreen; tests for save + list + auth-required.

## P1 — Feature completeness — ✅ ALL DONE 2026-06-12

### ✅ T6. Doctor filter endpoints
- **Backend:** `GET /doctors/available-today`, `/video-call`, `/home-visit`, `/top-rated` (or one endpoint with `?filter=`). available-today uses `is_available_today`; video/home filter by consultation_type name; top-rated by `average_rating >= 4.5` ordered desc.
- **Frontend:** ConsultScreen filter tabs currently filter client-side mock; wire to endpoints.
- **Accept:** Each tab shows distinct server-filtered list; tests per filter.

### ✅ T7. Session catalogs (wellness + relief)
- **Backend:** models `WellnessSession` and `ReliefSession` mirroring `src/data/yogaSessionData.js` / `reliefSessionData.js` shapes (key, title, type, duration, steps JSON, media URLs). Seed from those files. `GET /api/v1/sessions`, `GET /api/v1/sessions/:key`, `GET /api/v1/relief-sessions`, `GET /api/v1/relief-sessions/:key`.
- **Frontend:** wellnessService/reliefService already call these with mock fallbacks.
- **Accept:** Players run from API content with mocks deleted; tests for list + detail + unknown key.

### ✅ T8. Profile management endpoints
- **Backend:** `PUT /api/v1/auth/me` (full_name, avatar_url), `POST /api/v1/auth/change-password` (current + new, bcrypt verify, revoke refresh tokens on change), `DELETE /api/v1/auth/me` (soft-delete or hard-delete + cascade; revoke tokens).
- **Frontend:** SettingsScreen UI exists; wire forms + logout-on-delete.
- **Accept:** Tests: wrong current password 401, password change invalidates old refresh token, deleted user can't login.

### ✅ T9. Registration screen (frontend)
- **Frontend only:** `RegisterScreen` (full_name, email, password + confirm), calls existing `POST /auth/register`, then auto-login. Add to RootStack + link from LoginScreen.
- **Accept:** New account can register → land on Main tabs; jest test for the screen.

### ✅ T10. Axios auto-refresh on 401
- **Frontend only:** response interceptor in `src/api/client.js`: on 401 (not from `/auth/login|/auth/refresh`), call `ENDPOINTS.REFRESH` with the keychain refresh token, store the new access token (`secureStorage`), replay the original request; queue concurrent 401s behind one refresh; on refresh failure clear tokens + reset to Login.
- **Accept:** Unit test with mocked axios adapter: expired access token → one refresh call → original request succeeds; refresh failure → logout.

### ✅ T11. Payment processing (Razorpay sandbox) — *checkout SDK for real keys still open*
- **Backend:** `Payment` model (appointment FK, amount, currency, provider ref, status) + `POST /api/v1/payments/process` (sandbox order create) + webhook/verify endpoint.
- **Frontend:** PaymentScreen wired to order → Razorpay checkout (react-native-razorpay) → verify.
- **Accept:** Sandbox payment marks appointment paid; failure path leaves it unpaid; tests with provider mocked.

## P2 — Polish / platform — partially done 2026-06-12 (T12, T15, T18, T19 ✅)

### ✅ T12. Wellness rows on Home from API — done by reusing the T7 `GET /sessions` list; HomeScreen maps catalog keys to MCI icon names (`WELLNESS_ROW_ICONS`), shows the first 3 rows ("See All" → Wellness tab), keeps the local fallback offline.
### T13. Face Glow backend (routines model + `GET /face-glow/routines`, `/routines/:key`; scan + history later — needs media upload + storage decision).
### T14. Subscriptions (plans model + endpoints; billing provider decision pending).
### ✅ T15. Notification preferences persistence — `user_preferences` table (migration `e6f3a82d4c91`): `push_enabled` master + JSON dict of toggle ids (no migration per new toggle). `GET`/`PUT /api/v1/users/me/preferences` (auth, partial merge). SettingsScreen + NotificationsScreen toggles hydrate from the server and save optimistically (`preferencesService`). Push *delivery* (FCM/`expo-notifications`) still open.
### ✅ T16. Shared theme adoption — all 20 screens migrated to `src/constants/theme.js` tokens (COLORS/SPACING/RADIUS). Per-screen hex literals replaced; FaceGlow/logout/per-symptom brand colours preserved. `COLORS.danger` added to theme. JSX props (placeholderTextColor, ActivityIndicator color, Switch trackColor/thumbColor, RefreshControl colors, StatusBar backgroundColor, MCIcon color) all tokenised.
  - **2026-06-19 — Dark mode:** `theme.js` now exposes `LIGHT_COLORS`/`DARK_COLORS` + `getColors()`; the static `COLORS` export stays the light default for back-compat. New `useTheme()` hook (`src/hooks/useTheme.js`) + persisted `themeStore` resolve the active palette (with system-scheme detection). Core shells themed: shared `ScreenHeader`, bottom tab bar, NavigationContainer, Settings, Profile. **Remaining screens migrate to `useTheme()` incrementally** (convert their `StyleSheet.create` to a `makeStyles(colors)` factory).
### ✅ T17. Frontend test coverage — 6 service suites (wellnessService, reliefService, consultService, therapyService, preferencesService, authService) with axios/apiClient mocked; 3 screen smoke tests (HomeScreen, ConsultScreen, TherapyHistoryScreen) using react-test-renderer + act. Files in `mobile-users/src/__tests__/`. All tests use the existing jest preset + setup.
### ✅ T18. Wire `STRINGS` constants into HomeScreen empty `<Text>` labels (pre-existing PR #1 regression noted in FEATURES.md) — all 10 labels restored.
### ✅ T19. CI: `.github/workflows/ci.yml` — backend pytest (Python 3.13) + frontend jest/tsc/eslint (Node 22) on PRs and pushes to main.

---

## Environment / tooling notes (2026-06-13, updated)

- **RN 0.85.3 + Expo SDK 56** now installed (RN 0.84 had no matching Expo SDK — Expo skipped it).
- **Android builds on a new machine need:** Android Studio (or cmdline-tools) with SDK 36, `ANDROID_HOME` set, JDK 17+ (21 present). This machine currently has **no Android SDK** — install before `npx react-native run-android`. First gradle run should also execute `gradlew wrapper --gradle-version 9.3.1` to refresh wrapper scripts/jar (distributionUrl already bumped; old wrapper jar works but is from 9.0).
- **Node:** v23.8 works but is outside RN 0.85's supported engines — prefer Node 22.13+ LTS or 24.3+.
- **Folders renamed (2026-06-13):** `wellness-frontend` → `mobile`, `wellness-backend` → `backend`. CI workflow and package-lock cache paths updated to match.
- **Folders renamed (2026-06-17):** `mobile` → `mobile-users` (patient app), and a new **`mobile-doctors`** RN skeleton added for the doctor-facing app. CI `frontend` job + `.gitignore` (`mobile-*/` globs) updated to match.
- **API URL config:** `mobile-users/.env` → `EXPO_PUBLIC_API_URL` (inlined at bundle time; defaults to `http://10.0.2.2:5000`).
