# Wellness Backend API

Enterprise-grade wellness SaaS backend built with **FastAPI**.

## Tech Stack
- **Framework:** FastAPI (ASGI, served by Uvicorn)
- **ORM:** SQLAlchemy 2.0
- **Migrations:** Alembic
- **Authentication:** JWT (PyJWT — access + refresh tokens with revocation)
- **Validation:** Pydantic v2
- **Documentation:** OpenAPI / Swagger UI (built-in, auto-generated)
- **Database:** PostgreSQL (SQLite fallback for local development)
- **Tests:** pytest + FastAPI TestClient

## Folder Structure
```text
backend/
├── app/
│   ├── main.py            # FastAPI app factory, middleware, exception handlers
│   ├── api/
│   │   ├── deps.py        # Dependencies: get_db, JWT auth, role checks
│   │   └── v1/
│   │       ├── router.py  # Aggregates all v1 routers
│   │       └── endpoints/ # Route handlers (auth, doctors, home)
│   ├── core/
│   │   ├── config.py      # Pydantic Settings (.env driven)
│   │   └── security.py    # Password hashing + JWT create/decode
│   ├── db/
│   │   ├── base_class.py  # Declarative Base
│   │   ├── base.py        # Imports all models (for Alembic/tests)
│   │   └── session.py     # Engine + SessionLocal
│   ├── models/            # SQLAlchemy database models
│   ├── schemas/           # Pydantic request/response schemas
│   ├── repositories/      # Data access layer (DB queries)
│   ├── services/          # Business logic layer
│   └── utils/             # Response envelope helpers
├── alembic/               # Database migration scripts
├── alembic.ini            # Alembic configuration
├── tests/                 # pytest suite (runs against in-memory SQLite)
├── seed.py                # Development seed data
├── requirements.txt       # Python dependencies
└── run.py                 # Dev entry point (uvicorn with reload)
```

## Development Workflow

Follow this layered architecture when adding new features:

| Layer | Folder | Responsibility |
| :--- | :--- | :--- |
| **Model** | `app/models/` | Define database schemas (SQLAlchemy). |
| **Schema** | `app/schemas/` | Define request/response validation (Pydantic). |
| **Repository** | `app/repositories/` | Direct database operations (CRUD). Keep logic minimal. |
| **Service** | `app/services/` | Business logic, calculations, and data processing. |
| **Endpoint** | `app/api/v1/endpoints/` | Route handlers: parse request, call services, return responses. |
| **Router** | `app/api/v1/router.py` | Register endpoint routers. |

### How to Add a New Database Schema
1. **Define Model:** Create a new file in `app/models/` and define your SQLAlchemy class (inherit from `app.db.base_class.Base`).
2. **Register Model:** Import it in `app/db/base.py` so Alembic detects it.
3. **Generate Migration:**
   ```bash
   alembic revision --autogenerate -m "added product table"
   ```
4. **Apply Changes:**
   ```bash
   alembic upgrade head
   ```

## Setup & Installation

### 1. Create a virtualenv and install dependencies
```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

### 2. Environment Configuration
```bash
cp .env.example .env
```
Update `.env` with your credentials. If `DATABASE_URL` is omitted, the app uses a local SQLite file (`wellness.db`) — convenient for development.

Optional settings (see `.env.example` for the full list):
- `REDIS_URL` — enables Redis-backed rate-limit counters (shared across workers) and a revoked-token cache. Omit for local dev: rate limits fall back to in-memory, token revocation to the DB.
- `CORS_ORIGINS` — comma-separated allowed origins. Defaults to `*`; restrict in production.
- `RATE_LIMIT_ENABLED` / `RATE_LIMIT_LOGIN` / `RATE_LIMIT_REGISTER` / `RATE_LIMIT_REFRESH` — per-IP auth rate limits (defaults: 5/minute, 3/minute, 10/minute).

### 3. Apply migrations (PostgreSQL)
```bash
alembic upgrade head
```

### 4. Seed development data (optional)
```bash
python seed.py
```
Creates specialties, consultation types, languages, expertise, and 3 demo doctors (passwords bcrypt-hashed).

## Running the Application

```bash
python run.py
```
The server starts at `http://127.0.0.1:5000/` (reload enabled).

For production:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

## Running Tests

```bash
pytest
```
Tests run against an in-memory SQLite database — no PostgreSQL needed.

## API Documentation
With the server running:
- Swagger UI: `http://127.0.0.1:5000/apidocs`
- ReDoc: `http://127.0.0.1:5000/redoc`
- OpenAPI JSON: `http://127.0.0.1:5000/openapi.json`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | — | Create account |
| POST | `/api/v1/auth/login` | — | Get access + refresh tokens |
| GET | `/api/v1/auth/me` | Access token | Current user |
| POST | `/api/v1/auth/refresh` | Refresh token | New access token |
| POST | `/api/v1/auth/logout` | Refresh token | Revoke refresh token |
| GET | `/api/v1/auth/admin/dashboard` | Access + admin role | Admin-only |
| GET | `/api/v1/doctors` | — | Paginated doctor list (`?page=&limit=&search=`) |
| GET | `/api/v1/home/quick-relief` | — | Quick relief cards |
| GET | `/health` | — | Health check |
