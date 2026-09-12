# PurnaZen

A wellness and mental health app built with React Native (Expo bare workflow) and FastAPI.

## Project Structure

```
.
├── mobile-users/    # React Native patient app (Expo SDK 56, RN 0.85)
├── mobile-doctors/  # React Native doctor app (same stack)
├── mobile-admin/    # React Native admin app (same stack)
├── backend/         # FastAPI backend (Python 3.12, SQLite → Postgres)
├── docs/            # Architecture, features, changelog
└── .github/
    └── workflows/
        └── ci.yml   # PR/push checks (pytest + jest/tsc/eslint x3 apps)
```

> Three front-end apps share one backend: **mobile-users** (patients — full
> feature set), **mobile-doctors** (doctors — dashboard, appointments, schedule,
> patients, clinical records) and **mobile-admin** (admin console — doctors,
> users, appointments, slots/leaves, metadata, roles, videos). Feature status
> for all three: [docs/FEATURES.md](docs/FEATURES.md).

### Running the apps side by side (Metro ports)

Each app pins its own Metro / dev-server port so all three can run at once
without colliding on the default 8081. The port is baked into the debug build
via `reactNativeDevServerPort` in `android/gradle.properties` and matched by the
`start` / `android` npm scripts:

| App | Metro port |
|-----|-----------|
| `mobile-users`   | 8081 |
| `mobile-doctors` | 8082 |
| `mobile-admin`   | 8083 |

`npm run android` / `npm start` in each folder already pass the right `--port`.

### Windows: enable long paths (required for native builds)

React Native's C++ codegen produces object-file paths well over Windows' legacy
260-character limit, which makes the `:app:buildCMakeDebug` (ninja) task fail
with `Filename longer than 260 characters`. Enable long-path support once, as
Administrator, then restart:

```powershell
# Run in an elevated PowerShell
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' `
  -Name LongPathsEnabled -Value 1 -Type DWord
git config --system core.longpaths true   # (this repo already sets it per-user)
```

After enabling, do a clean native build: `cd mobile-admin/android && ./gradlew clean`.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22.x |
| Python | 3.12 (mediapipe/opencv wheels stop at 3.12 — see `backend/requirements.txt`) |
| JDK | 17 (for Android builds) |
| Android SDK | API 36 (compileSdk/targetSdk 36) |

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

## Mobile Setup (patient app — `mobile-users`)

> The doctor and admin apps follow the same steps in their own folders (Metro
> ports 8082/8083) — see [mobile-doctors/README.md](mobile-doctors/README.md)
> and [mobile-admin/README.md](mobile-admin/README.md).

```bash
cd mobile-users
npm install
```

### Environment Variables

Create `.env` in `mobile-users/` with:

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

### iOS builds

`scripts/build-ios.sh` does the whole loop on a Mac — npm ci, `pod install`,
`xcodebuild` — and writes every line of output to `build-logs/ios-build.log`:

```bash
scripts/build-ios.sh                     # users app, simulator, Debug
scripts/build-ios.sh mobile-users device # generic iOS device, Release, unsigned
```

Each app needs its own `GoogleService-Info.plist` (Firebase console → iOS app →
bundle id `com.purnazen`) dropped into `<app>/ios/<target>/`. Without it the app
compiles but crashes at launch, because sign-in, push and Crashlytics all
initialise from it. Signing a distributable `.ipa` additionally needs an Apple
Developer account and a provisioning profile for that bundle id.

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

## Deployment & releases (Azure + GitHub Actions)

Manual, OIDC-secured pipelines deploy the backend to **Azure Container Apps** and
publish signed Android **AAB/APK** artifacts as **GitHub Releases**:

- **Deploy Backend** — build image in ACR → roll the Container App → validate `/health`
- **Release Mobile Apps** — signed, renamed `purnazen-<app>-v<version>` artifacts → GitHub Release
- **Service Status** — read-only health/status report

Setup lives in the pipelines themselves — `scripts/provision-azure-prod.sh`
(resource provisioning), `scripts/setup-github-oidc.sh` (OIDC federation) and
the `env:` blocks of the workflows above, which name every GitHub secret and
variable they need.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for architectural decisions.
