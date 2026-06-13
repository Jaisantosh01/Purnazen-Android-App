# PurnaZen

A wellness and mental health app built with React Native (Expo bare workflow) and FastAPI.

## Project Structure

```
.
├── mobile/          # React Native frontend (Expo SDK 56, RN 0.85)
├── backend/         # FastAPI backend (Python 3.13, SQLite → Postgres)
├── docs/            # Architecture, features, changelog
└── .github/
    └── workflows/
        ├── ci.yml          # PR/push checks (pytest + jest + tsc + eslint)
        └── android-build.yml  # Manual APK release build
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22.x |
| Python | 3.13 |
| JDK | 17 (for Android builds) |
| Android SDK | API 35+ (for local builds) |

---

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```
DATABASE_URL=sqlite:///./wellness.db   # or postgresql://...
SECRET_KEY=<your-secret-key>
RAZORPAY_KEY_ID=                       # optional — enables live payments
RAZORPAY_KEY_SECRET=
```

### Run

```bash
# Apply migrations
alembic upgrade head

# Seed development data (optional)
python seed.py

# Start the dev server
python run.py
# → API available at http://localhost:5000
```

### Tests

```bash
python -m pytest -q
```

---

## Mobile Setup

```bash
cd mobile
npm install
```

### Environment Variables

Create `.env` in `mobile/` with:

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000   # emulator → host machine
# For physical device: use your machine's local IP (e.g. http://192.168.1.50:5000)
```

### Run

```bash
# Android emulator
npm run android

# iOS simulator
npm run ios

# Metro bundler only
npm start
```

### Tests

```bash
npm test                   # jest
npx tsc --noEmit           # type check
npx eslint src App.tsx     # lint
```

---

## Database Seed

The backend ships with two seed scripts:

| Script | Purpose |
|--------|---------|
| `backend/seed.py` | Minimal seed — auth users + session catalog |
| `backend/seed_data.py` | Full demo data — doctors, appointments, therapy history |

```bash
cd backend
python seed.py         # or
python seed_data.py
```

After seeding, a demo user is available:

| Field | Value |
|-------|-------|
| Email | `demo@purnazen.com` |
| Password | `demo1234` |

---

## Android APK Build (manual)

Trigger the **Android APK Build** workflow from the Actions tab on GitHub.  
The signed APK is uploaded as a workflow artifact for download.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architectural decisions.
