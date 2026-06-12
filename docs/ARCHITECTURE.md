# Architecture

**Last updated:** 2026-06-12 (post Flask → FastAPI migration + tech-debt pass)

## System Overview

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│   React Native App (0.84)   │  HTTP   │   FastAPI Backend (Uvicorn)  │
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

- **Base URL:** `http://10.0.2.2:5000` (Android emulator → host machine)
- **Auth:** JWT Bearer. Access token (15 min) for API calls; refresh token (30 days) for `/refresh` and `/logout`. Revoked tokens tracked by `jti` in the `token_blocklist` table (cached in Redis when `REDIS_URL` is set). On the device, tokens live in the keystore (react-native-keychain), not AsyncStorage.
- **Rate limiting:** slowapi, per client IP, on login (5/min), register (3/min), refresh (10/min) — `RATE_LIMIT_*` env vars; 429 + standard envelope when exceeded. Counters are shared across workers when Redis is configured, per-process in-memory otherwise.
- **CORS:** origins from `CORS_ORIGINS` (comma-separated); default `*` is dev-only.
- **API docs:** auto-generated OpenAPI at `/apidocs` (Swagger UI) and `/redoc`, with endpoint summaries and the envelope/auth/rate-limit contract in the description.

---

## Backend (`wellness-backend/`) — FastAPI

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
wellness-backend/
├── app/
│   ├── main.py              # App factory: CORS, routers, exception handlers, /health
│   ├── api/
│   │   ├── deps.py          # get_db, get_access_payload, get_refresh_payload,
│   │   │                    #   get_current_user, require_role(role)
│   │   └── v1/
│   │       ├── router.py    # Aggregates endpoint routers under /api/v1
│   │       └── endpoints/
│   │           ├── auth.py     # register, login, logout, me, refresh, admin
│   │           ├── doctors.py  # GET /doctors (pagination + search)
│   │           └── home.py     # GET /home/quick-relief
│   ├── core/
│   │   ├── config.py        # Settings (pydantic-settings): secrets, DB URL, expiries,
│   │   │                    #   CORS_ORIGINS, REDIS_URL, RATE_LIMIT_*
│   │   ├── security.py      # bcrypt hash/verify; JWT create/decode (PyJWT)
│   │   ├── limiter.py       # slowapi Limiter (Redis storage when REDIS_URL set)
│   │   └── cache.py         # Optional Redis client (None when REDIS_URL unset)
│   ├── db/
│   │   ├── base_class.py    # DeclarativeBase
│   │   ├── base.py          # Imports every model → Base.metadata complete
│   │   └── session.py       # create_engine + SessionLocal
│   ├── models/              # 14 SQLAlchemy models (one file each; associations.py
│   │                        #   holds the 3 many-to-many Tables)
│   ├── schemas/             # Pydantic request schemas (auth.py)
│   ├── repositories/        # UserRepository, TokenRepository, DoctorRepository,
│   │                        #   QuickReliefRepository — all take a Session arg
│   ├── services/            # AuthService, DoctorService, HomeService
│   └── utils/responses.py   # success_response / error_response (JSON envelope)
├── alembic/                 # Plain Alembic (env.py reads settings.DATABASE_URL)
│   └── versions/            # 4 revisions (users → doctor module → quick_reliefs → avatar)
├── alembic.ini
├── tests/                   # 25 pytest tests, in-memory SQLite, get_db override
│                            #   (limiter off by default; rate_limited_client fixture)
├── seed.py                  # Idempotent dev seed (bcrypt-hashed passwords)
├── requirements.txt
└── run.py                   # uvicorn app.main:app --reload, port 5000
```

### Database Schema (14 tables)

| Table | Purpose |
|-------|---------|
| `users` | Accounts: full_name, avatar_url, email, bcrypt password, role (patient/doctor/admin) |
| `token_blocklist` | Revoked JWT `jti`s (logout) |
| `doctors` | Doctor profile: FK user, FK specialty, fee, rating, experience, availability flag |
| `specialties` | Doctor specialties |
| `clinics` | Doctor clinics with geo coordinates |
| `doctor_availability` | Weekly schedule rows (day, start/end, slot duration) |
| `awards` | Doctor awards |
| `expertise`, `languages`, `consultation_types` | Lookup tables |
| `doctor_expertise`, `doctor_languages`, `doctor_consultation_types` | Many-to-many links |
| `quick_reliefs` | Home-screen quick relief cards (slug, icon, colors, sort order) |

### Conventions

- **Response envelope:** every endpoint returns `{"success": bool, "message": str, "data": ...}` (exceptions: `/api/v1/doctors` omits `message`; `/api/v1/home/quick-relief` returns bare `{"data": [...]}`; both preserved for frontend compatibility).
- **Validation errors** return **400** (not FastAPI's default 422) with `{field: [messages]}` — same contract as the old Marshmallow validators.
- **Auth dependencies**, not decorators: `Depends(get_access_payload)` ≈ old `@jwt_required()`, `Depends(get_refresh_payload)` ≈ `@jwt_required(refresh=True)`, `Depends(require_role("admin"))` ≈ `@role_required('admin')`.
- **Adding a feature:** model → import in `db/base.py` → `alembic revision --autogenerate` → schema → repository → service → endpoint → include in `router.py` → tests.

---

## Frontend (`wellness-frontend/`) — React Native 0.84 (bare)

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
wellness-frontend/src/
├── api/client.js            # axios instance + get/post/put/delete (returns body)
├── utils/secureStorage.js   # Keystore-backed token storage (react-native-keychain)
│                            #   + one-time AsyncStorage migration
├── store/authStore.js       # Zustand: user, isLoggedIn, setAuth, clearAuth
├── services/                # authService, consultService, wellnessService,
│                            #   reliefService, therapyService
├── screens/                 # 19 screens (see FEATURES.md)
├── components/              # QuickCards, BottomNav
├── constants/
│   ├── apiEndpoints.js      # BASE_URL + all endpoint paths
│   └── strings.js           # UI display strings
├── data/                    # Mock fallback data (8 files)
└── App.tsx                  # Navigation root (stack + bottom tabs)
```

### Navigation

```
RootStack
├── Login
└── Main (Bottom Tabs)
    ├── Home Stack     → Home, SelectSymptom, FaceGlow, YogaSession, ReliefSession
    ├── Relief Stack   → Relief, ReliefSession
    ├── Wellness Stack → Wellness, YogaSession
    ├── Consult Stack  → Consult, DoctorProfile, BookAppointment, BookingConfirmed, Payment
    └── Profile Stack  → Profile, TherapyHistory, HelpSupport, Settings, Subscriptions, Notifications
```

### Known Constraints

- **Expo modules:** blocked — no Expo SDK supports RN 0.84 yet (`install-expo-modules` refuses). `react-native-keychain` is used for secure token storage instead.
- **AsyncStorage v3 API:** `multiGet/multiSet/multiRemove` no longer exist — use `getMany/setMany/removeMany`.
- **Mock fallbacks:** wellness/relief/therapy/consult-detail services fall back to `src/data/*.js` when the corresponding backend endpoint doesn't exist yet (see FEATURES.md).
