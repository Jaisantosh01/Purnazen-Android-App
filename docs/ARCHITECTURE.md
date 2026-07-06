# Architecture

**Last updated:** 2026-07-03 (endpoint/model counts, navigation tree, doctor-app status refreshed after PR #22) · Face Analysis pipeline write-up: [FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)

## System Overview

The repo ships **three React Native apps against one FastAPI backend**, each gated
to a single role (`expected_role` on login): **`mobile-users`** (patient,
brand-green), **`mobile-admin`** (admin, burnt-orange), **`mobile-doctors`**
(doctor, clinical-blue). They share the same conventions and a common
client-side pattern — `constants/theme.js` (light/dark palettes) + `hooks/useTheme.js`
+ `store/themeStore.js` for theming, `services/biometricService.js` for biometric
unlock, and `utils/alert.js` + `components/AppAlertHost.js` for themed alerts —
ported per app rather than shared as a package.

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│   React Native App (0.85)   │  HTTP   │   FastAPI Backend (Uvicorn)  │
│                             │ ──────► │                              │
│  Screens → Services →       │  JSON   │  Endpoints → Services →      │
│  axios client (Bearer JWT)  │ ◄────── │  Repositories → SQLAlchemy   │
└─────────────────────────────┘         └──────────────┬───────────────┘
                                                       │
                                            ┌──────────▼───────────┐
                                            │ PostgreSQL           │
                                            │ (SQLite fallback     │
                                            │  for local dev)      │
                                            └──────────────────────┘
```

- **Base URL:** `BASE_URL` in each app's `src/config/index.js` (`EXPO_PUBLIC_API_URL || 'http://localhost:5000'`). Note `react-native start` does **not** load `.env`, so the `||` fallback is what ships in dev; `localhost:5000` reaches the host via `adb reverse tcp:5000 tcp:5000` on both device and emulator. See [RUNNING.md §2.1](RUNNING.md#21-point-the-app-at-the-backend)
- **Auth:** JWT Bearer. Access token (15 min) for API calls; refresh token (30 days) for `/refresh` and `/logout`. Revoked tokens tracked by `jti` in the `token_blocklist` table (cached in Redis when `REDIS_URL` is set) **plus** a per-user `token_version` (`ver` claim) that invalidates every outstanding token on password change or account deletion. On the device, tokens live in the keystore (react-native-keychain), not AsyncStorage; the axios client silently refreshes expired access tokens on 401 and resets to Login when the refresh token dies.
- **Rate limiting:** slowapi, per client IP, on login (5/min), register (3/min), refresh (10/min) — `RATE_LIMIT_*` env vars; 429 + standard envelope when exceeded. Counters are shared across workers when Redis is configured, per-process in-memory otherwise.
- **CORS:** origins from `CORS_ORIGINS` (comma-separated); default `*` is dev-only.
- **API docs:** auto-generated OpenAPI at `/apidocs` (Swagger UI) and `/redoc`, with endpoint summaries and the envelope/auth/rate-limit contract in the description.

---

## Backend (`backend/`) — FastAPI

### Request Flow

```
HTTP request
  → app/main.py            (CORS, exception handlers)
  → app/api/v1/router.py   (route dispatch)
  → app/api/v1/endpoints/  (parse request — Pydantic schema / Query params,
  │                         auth via Depends from app/api/deps.py)
  → app/services/          (business logic)
  → app/repositories/      (DB queries)
  → app/models/            (SQLAlchemy ORM)
  ← JSON response          ({"success", "message", "data"} envelope)
```

### Layout

```text
backend/
├── app/
│   ├── main.py              # App factory: CORS, routers, exception handlers, /health
│   ├── api/
│   │   ├── deps.py          # get_db, get_access_payload, get_refresh_payload,
│   │   │                    #   get_current_user, require_role(role)
│   │   └── v1/
│   │       ├── router.py    # Aggregates endpoint routers under /api/v1
│   │       └── endpoints/   # 29 modules / ~131 routes (full inventory: FEATURES.md
│   │                        #   "Backend platform" table). Groups:
│   │                        #   - auth, users, user_addresses, consent, error_report
│   │                        #   - doctors, doctor_availability, doctor_leaves,
│   │                        #     specialties, expertises, languages, slot_timings, roles
│   │                        #   - appointments, consultations (clinical records), payments
│   │                        #   - home, sessions, therapy_history, therapy_feedback, chat
│   │                        #   - face_glow, face_scan
│   │                        #   - videos (+ video groups + Azure Blob upload), support (CMS),
│   │                        #     dashboard (admin stats), app_releases (OTA)
│   ├── core/
│   │   ├── config.py        # Settings (pydantic-settings): secrets, DB URL, expiries,
│   │   │                    #   CORS_ORIGINS, REDIS_URL, RATE_LIMIT_*, RAZORPAY_KEY_*
│   │   ├── security.py      # bcrypt hash/verify; JWT create/decode (PyJWT, "ver" claim)
│   │   ├── payment_provider.py # Razorpay order create + HMAC signature verify;
│   │   │                    #   keyless local-sandbox mode for dev/tests
│   │   ├── limiter.py       # slowapi Limiter (Redis storage when REDIS_URL set)
│   │   └── cache.py         # Optional Redis client (None when REDIS_URL unset)
│   ├── db/
│   │   ├── base_class.py    # DeclarativeBase
│   │   ├── base.py          # Imports every model → Base.metadata complete
│   │   └── session.py       # create_engine + SessionLocal
│   ├── models/              # 41 SQLAlchemy model files (one per table; associations.py
│   │                        #   holds the many-to-many Tables)
│   ├── schemas/             # Pydantic request schemas (one per feature area)
│   ├── repositories/        # One repository per aggregate — all take a Session arg
│   ├── services/            # One service per feature area (business logic),
│   │                        #   plus scan_pipeline_service, recommendation_engine_service,
│   │                        #   upload/azure_storage helpers
│   ├── ai/                  # Face analysis pipeline (Sprint 3) — see FACE_ANALYSIS_AI.md
│   │   ├── face_detector.py      # MediaPipe FaceLandmarker singleton (+ Haar fallback)
│   │   ├── image_preprocessor.py # resize, blur/lighting checks, landmark-indexed ROIs
│   │   ├── face_landmarker.task   # MediaPipe model asset (auto-downloaded if absent)
│   │   └── analyzers/             # 9 metric analyzers + glow_score_engine + toxin_indicator
│   └── utils/responses.py   # success_response / error_response (JSON envelope)
├── alembic/                 # Plain Alembic (env.py reads settings.DATABASE_URL)
│   └── versions/            # 59 revisions — heads were merged 2026-06-17; if you hit a
│                            #   branched-head error see RUNNING.md §1.3
├── alembic.ini
├── tests/                   # pytest suites, in-memory SQLite, get_db override
│                            #   (limiter off by default; rate_limited_client fixture)
├── seed.py                  # Idempotent dev seed (bcrypt-hashed passwords)
├── seed_data.py             # Session catalog content (ported from frontend mocks)
├── requirements.txt
└── run.py                   # uvicorn app.main:app --reload, port 5000
```

### Database Schema (~41 tables)

Core tables below; later features added their own (all follow the same
model → migration pattern): `doctor_leaves`, `slot_timings`, `roles`,
`user_addresses`, `therapy_feedback`, `consultation_records`,
`chat_questions`/`chat_options`, `videos`/`video_groups`/`video_group_mappings`,
`support_contacts`/`support_faqs`, `app_releases`, `day_of_week`.

| Table | Purpose |
|-------|---------|
| `users` | Accounts: full_name, avatar_url, email, bcrypt password, role (patient/doctor/admin), token_version (bumped on password change → revokes all JWTs) |
| `token_blocklist` | Revoked JWT `jti`s (logout) |
| `doctors` | Doctor profile: FK user, FK specialty, fee, rating, experience, availability flag |
| `specialties` | Doctor specialties |
| `clinics` | Doctor clinics with geo coordinates |
| `doctor_availability` | Weekly schedule rows (day, start/end, slot duration) |
| `awards` | Doctor awards |
| `expertise`, `languages`, `consultation_types` | Lookup tables |
| `doctor_expertise`, `doctor_languages`, `doctor_consultation_types` | Many-to-many links |
| `quick_reliefs` | Home-screen quick relief cards (slug, icon, colors, sort order) |
| `appointments` | Bookings: user FK, doctor FK, visit type, date, slot start/end, fee, status (booked/cancelled/completed), payment_status (unpaid/paid) |
| `therapy_sessions` | Completed wellness/relief sessions: user FK, title, type, duration, pain before/after, completed_at |
| `wellness_sessions` | Wellness player catalog: key, title, duration label, icon, video URL, cycles, steps JSON |
| `relief_sessions` | Relief player catalog (same shape, keyed by reliefKey e.g. "Neck Pain") |
| `payments` | Razorpay payments: user FK, appointment FK, amount, order/payment ids, status (created/paid/failed) |
| `user_preferences` | Per-user notification prefs: push_enabled master + JSON dict of toggle ids |
| `face_glow_routines` | Face Glow routine catalog (DB-backed; Redis cache-aside) |
| `user_consents` | GDPR consents (scan_storage/ai_training/gdpr_data; granted/revoked + IP/UA) |
| `face_scans` | Uploaded scan records: image refs, status, `progress_stage`, `face_detected`/`face_confidence`, `blur_score`, `lighting_quality`, `landmarks_json` |
| `scan_results` | Per-scan metric scores (9 metrics + glow/toxin/skin-age/overall) + raw_metrics |
| `scan_recommendations` | TCM recommendations per scan (type, priority, title, body, routine key) |

### Face Analysis pipeline (Sprint 3)

`POST /face-glow/scan/upload` validates + stores the image (`UploadService` →
Cloudinary or local disk), creates a `face_scans` row, and schedules
`scan_pipeline_service.run_scan_pipeline()` as a FastAPI **BackgroundTask** (it
opens its **own** `SessionLocal()` — the request session is already closed). The
task streams `progress_stage` (`preprocessing→detecting→analyzing→scoring→done`)
that the mobile `ScanProcessingScreen` polls via `GET /scan/:id/status`. It runs
MediaPipe landmark detection (with OpenCV Haar / centred-crop fallbacks), the 9
analyzers in a `ThreadPoolExecutor`, composite scoring, then persists
`scan_results` + `scan_recommendations`. Full detail: **[FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)**.

### Conventions

- **Response envelope:** every endpoint returns `{"success": bool, "message": str, "data": ...}` (exceptions: `/api/v1/doctors` omits `message`; `/api/v1/home/quick-relief` returns bare `{"data": [...]}`; both preserved for frontend compatibility).
- **Validation errors** return **400** (not FastAPI's default 422) with `{field: [messages]}` — same contract as the old Marshmallow validators.
- **Auth dependencies**, not decorators: `Depends(get_access_payload)` ≈ old `@jwt_required()`, `Depends(get_refresh_payload)` ≈ `@jwt_required(refresh=True)`, `Depends(require_role("admin"))` ≈ `@role_required('admin')`.
- **Adding a feature:** model → import in `db/base.py` → `alembic revision --autogenerate` → schema → repository → service → endpoint → include in `router.py` → tests.

---

## Frontend (`mobile-users/`) — React Native 0.85 (bare + Expo modules, SDK 56)

> Three RN apps share this backend: **`mobile-users/`** (patient app — described
> below, full feature set), **`mobile-doctors/`** (doctor app — dashboard,
> appointments, schedule, patients, clinical records; see
> `mobile-doctors/README.md`) and **`mobile-admin/`** (admin app — management
> console). Each pins a distinct Metro port (8081 / 8082 /
> 8083) and a distinct `applicationId` (`com.purnazen` / `.doctor` / `.admin`) so
> they coexist on one device — see [RUNNING.md](RUNNING.md). The architecture
> below is the patient app.

### Data Flow

```
Screen component
  → src/services/*.js        (feature-level API methods, mock-data fallbacks)
  → src/api/client.js        (axios: BASE_URL, Bearer token from secureStorage,
  │                           error normalization, 15 s timeout)
  → Backend REST API

Global state: src/store/authStore.js (Zustand) — user + isLoggedIn,
kept in sync by authService (login/logout/bootstrap; bootstrap runs on App mount).
Persistence: tokens in the device keystore via src/utils/secureStorage.js
(react-native-keychain, in-memory cached); user JSON in AsyncStorage.
```

### Layout

```text
mobile-users/src/
├── config/index.js          # BASE_URL from EXPO_PUBLIC_API_URL (.env), API_VERSION
├── api/client.js            # axios instance + get/post/put/delete (returns body);
│                            #   silent refresh-on-401 with single-flight queueing
├── navigation/navigationRef.js # Root nav handle (resetToLogin from interceptors/screens)
├── utils/secureStorage.js   # Keystore-backed token storage (react-native-keychain)
│                            #   + one-time AsyncStorage migration
├── store/                   # Zustand stores: authStore (user/isLoggedIn),
│                            #   scanStore (face-scan flow state)
├── services/                # authService, consultService (incl. payments),
│                            #   wellnessService, reliefService, therapyService,
│                            #   preferencesService, scanService, consentService,
│                            #   supportService, biometricService, permissionsService,
│                            #   updateService (OTA), errorReportingService
├── screens/                 # Screens (see FEATURES.md) — incl. RegisterScreen and the
│                            #   scan flow (FaceScan/ScanProcessing/ScanResults/ScanError)
├── components/              # QuickCards, ErrorBoundary, ServiceUnavailable,
│                            #   scan/ (FaceOverlayGuide, FaceMeshOverlay,
│                            #   MetricScoreRow, RecommendationCard)
├── constants/
│   ├── apiEndpoints.js      # All endpoint paths (re-exports BASE_URL from config)
│   ├── theme.js             # COLORS / SPACING / RADIUS design tokens
│   └── strings.js           # UI display strings
├── data/                    # Mock fallback data (.js files) — offline/instant-render
│                            #   fallbacks; API content wins once fetched
└── App.tsx                  # Navigation root (stack + bottom tabs); calls
                             #   authService.bootstrap() on mount
```

### Navigation

```
RootStack
├── Login
├── Register
├── ProfileCompletion (post-signup phone/gender/DOB)
└── Main (Bottom Tabs)
    ├── Home Stack     → Home, SelectSymptom, FaceGlow, FaceScan, TongueScan,
    │                     ScanProcessing, ScanResults, ScanHistory, ScanDashboard,
    │                     ScanComparison, ScanError, YogaSession, ReliefSession,
    │                     ChatAssistant, VideoPlayer
    ├── Relief Stack   → Relief, ReliefSession, ChatAssistant, VideoPlayer
    ├── Wellness Stack → Wellness, YogaSession, VideoPlayer
    ├── Consult Stack  → Consult, DoctorProfile, BookAppointment, BookingConfirmed,
    │                     AppointmentHistory, AppointmentDetail, Payment
    └── Profile Stack  → Profile, AppointmentHistory, AppointmentDetail, TherapyHistory,
                          VideoPlayer, ReliefSession, HelpSupport, Settings, Consent,
                          Subscriptions, Notifications, AddressManagement
```

### Known Constraints

- **Expo modules:** installed (SDK 56) since the RN 0.85.3 upgrade — Expo skipped RN 0.84, which is why installs failed before. Babel preset is `babel-preset-expo`; Metro extends `expo/metro-config`; Android bundling goes through `expo export:embed`.
- **AsyncStorage v3 API:** `multiGet/multiSet/multiRemove` no longer exist — use `getMany/setMany/removeMany`.
- **Android SDK:** not installed on the current dev machine — JS-level verification only (jest/tsc/eslint/Metro bundle). See docs/TASKS.md environment notes before running `run-android`.
- **Mock fallbacks:** the wellness/relief player screens render from `src/data/*.js` immediately and swap to API content when the fetch resolves; the same files serve as offline fallbacks. ConsultScreen keeps a local `FILTER_TABS` fallback for the tab labels only.
- **Payments:** without `RAZORPAY_KEY_*` on the backend, the whole order→verify flow runs in local sandbox mode (no native checkout SDK). Integrating `react-native-razorpay` for real test keys requires a machine with the Android SDK.
