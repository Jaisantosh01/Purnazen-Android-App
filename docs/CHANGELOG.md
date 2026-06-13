# Changelog

All notable changes to the Purnazen App are documented here.

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
