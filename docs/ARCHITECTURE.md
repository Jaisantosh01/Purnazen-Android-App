# Architecture

**Last updated:** 2026-06-12 (post P2 first batch: T12/T15/T18/T19; CI added)

## System Overview

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

- **Base URL:** from `mobile/.env` → `EXPO_PUBLIC_API_URL`; defaults to `http://10.0.2.2:5000` (Android emulator → host machine)
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
│   │       └── endpoints/
│   │           ├── auth.py            # register, login, logout, refresh, admin;
│   │           │                      #   GET/PUT/DELETE /auth/me, /auth/change-password
│   │           ├── doctors.py         # GET /doctors (pagination + search), filter routes
│   │           │                      #   (/available-today, /video-call, /home-visit,
│   │           │                      #   /top-rated — registered before /doctors/:id),
│   │           │                      #   /doctors/:id, :id/visit-types, :id/time-slots
│   │           ├── home.py            # GET /home/quick-relief
│   │           ├── appointments.py    # POST /appointments/book, GET /appointments (auth)
│   │           ├── therapy_history.py # POST /therapy-history/save, GET /therapy-history (auth)
│   │           ├── sessions.py        # GET /sessions[/:key], /relief-sessions[/:key]
│   │           ├── payments.py        # POST /payments/process, /payments/verify (auth)
│   │           └── users.py           # GET/PUT /users/me/preferences (auth)
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
│   ├── models/              # 20 SQLAlchemy models (one file each; associations.py
│   │                        #   holds the 3 many-to-many Tables)
│   ├── schemas/             # Pydantic request schemas (auth.py, appointment.py,
│   │                        #   therapy.py, payment.py, preferences.py)
│   ├── repositories/        # UserRepository, TokenRepository, DoctorRepository,
│   │                        #   QuickReliefRepository, AppointmentRepository,
│   │                        #   TherapySessionRepository, SessionCatalogRepository,
│   │                        #   PaymentRepository, PreferenceRepository — all take a Session arg
│   ├── services/            # AuthService, DoctorService, HomeService,
│   │                        #   AppointmentService, TherapyService,
│   │                        #   SessionCatalogService, PaymentService, PreferenceService
│   └── utils/responses.py   # success_response / error_response (JSON envelope)
├── alembic/                 # Plain Alembic (env.py reads settings.DATABASE_URL)
│   └── versions/            # 10 revisions (users → doctor module → quick_reliefs → avatar
│                            #   → appointments → therapy_sessions → session catalogs
│                            #   → token_version → payments → user_preferences)
├── alembic.ini
├── tests/                   # 84 pytest tests, in-memory SQLite, get_db override
│                            #   (limiter off by default; rate_limited_client fixture)
├── seed.py                  # Idempotent dev seed (bcrypt-hashed passwords)
├── seed_data.py             # Session catalog content (ported from frontend mocks)
├── requirements.txt
└── run.py                   # uvicorn app.main:app --reload, port 5000
```

### Database Schema (20 tables)

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

### Conventions

- **Response envelope:** every endpoint returns `{"success": bool, "message": str, "data": ...}` (exceptions: `/api/v1/doctors` omits `message`; `/api/v1/home/quick-relief` returns bare `{"data": [...]}`; both preserved for frontend compatibility).
- **Validation errors** return **400** (not FastAPI's default 422) with `{field: [messages]}` — same contract as the old Marshmallow validators.
- **Auth dependencies**, not decorators: `Depends(get_access_payload)` ≈ old `@jwt_required()`, `Depends(get_refresh_payload)` ≈ `@jwt_required(refresh=True)`, `Depends(require_role("admin"))` ≈ `@role_required('admin')`.
- **Adding a feature:** model → import in `db/base.py` → `alembic revision --autogenerate` → schema → repository → service → endpoint → include in `router.py` → tests.

---

## Frontend (`mobile/`) — React Native 0.85 (bare + Expo modules, SDK 56)

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
mobile/src/
├── config/index.js          # BASE_URL from EXPO_PUBLIC_API_URL (.env), API_VERSION
├── api/client.js            # axios instance + get/post/put/delete (returns body);
│                            #   silent refresh-on-401 with single-flight queueing
├── navigation/navigationRef.js # Root nav handle (resetToLogin from interceptors/screens)
├── utils/secureStorage.js   # Keystore-backed token storage (react-native-keychain)
│                            #   + one-time AsyncStorage migration
├── store/authStore.js       # Zustand: user, isLoggedIn, setAuth, clearAuth
├── services/                # authService (register/login/profile/password/delete),
│                            #   consultService (incl. payments), wellnessService,
│                            #   reliefService, therapyService, preferencesService
├── screens/                 # 20 screens (see FEATURES.md) — incl. RegisterScreen
├── components/              # QuickCards
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
└── Main (Bottom Tabs)
    ├── Home Stack     → Home, SelectSymptom, FaceGlow, YogaSession, ReliefSession
    ├── Relief Stack   → Relief, ReliefSession
    ├── Wellness Stack → Wellness, YogaSession
    ├── Consult Stack  → Consult, DoctorProfile, BookAppointment, BookingConfirmed, Payment
    └── Profile Stack  → Profile, TherapyHistory, HelpSupport, Settings, Subscriptions, Notifications
```

### Known Constraints

- **Expo modules:** installed (SDK 56) since the RN 0.85.3 upgrade — Expo skipped RN 0.84, which is why installs failed before. Babel preset is `babel-preset-expo`; Metro extends `expo/metro-config`; Android bundling goes through `expo export:embed`.
- **AsyncStorage v3 API:** `multiGet/multiSet/multiRemove` no longer exist — use `getMany/setMany/removeMany`.
- **Android SDK:** not installed on the current dev machine — JS-level verification only (jest/tsc/eslint/Metro bundle). See docs/TASKS.md environment notes before running `run-android`.
- **Mock fallbacks:** the wellness/relief player screens render from `src/data/*.js` immediately and swap to API content when the fetch resolves; the same files serve as offline fallbacks. ConsultScreen keeps a local `FILTER_TABS` fallback for the tab labels only.
- **Payments:** without `RAZORPAY_KEY_*` on the backend, the whole order→verify flow runs in local sandbox mode (no native checkout SDK). Integrating `react-native-razorpay` for real test keys requires a machine with the Android SDK.
