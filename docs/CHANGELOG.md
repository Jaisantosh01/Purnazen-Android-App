# Changelog

All notable changes to the Purnazen App are documented here.

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
