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

Two scripts, both macOS-only, both logging everything to `build-logs/`.

```bash
scripts/ios-firebase-config.sh           # once: fetch GoogleService-Info.plist
scripts/build-ios.sh                     # build + run in the simulator
scripts/build-ios.sh mobile-users build  # compile only
scripts/build-ios.sh mobile-users device # generic iOS device, Release, unsigned
CLEAN=1 scripts/build-ios.sh             # wipe Pods + DerivedData first
```

Pods build as **static frameworks** (`use_frameworks! :linkage => :static`),
which is not optional: FirebaseAuth is a Swift pod, and Firebase's umbrella
header imports `<FirebaseAuth/FirebaseAuth-Swift.h>`, a path that only exists
when the pod is a framework. The Podfile explains it at the point of the
setting. Run with `CLEAN=1` after any change to that linkage.

`ios-firebase-config.sh` uses your `firebase login` session to find (or register)
the iOS app for the right bundle id and write `GoogleService-Info.plist` into
`<app>/ios/<target>/`. Commit the result — this repo already tracks the Android
`google-services.json`, and the iOS file gets the same treatment. Without it the
app compiles but dies on the splash screen: sign-in, push and Crashlytics all
initialise from it.

`build-ios.sh` runs `npm ci` if needed, `pod install`, `xcodebuild`, then boots a
simulator, installs, launches, and harvests the simulator log and any crash
report into `build-logs/ios-build.log`. A launch failure never reaches the
terminal, so that file is what to read — and what to share.

Still outstanding for an iOS **release** (none of it blocks development):

- An Apple Developer account, a registered `com.purnazen` bundle id and a
  provisioning profile — `device` mode builds unsigned until then.
- An APNs key uploaded to Firebase before push works on iOS at all.
- The Crashlytics dSYM upload build phase
  (`${PODS_ROOT}/FirebaseCrashlytics/run`). Crashes are collected without it,
  but the stacks arrive unsymbolicated.
- App icons: `Images.xcassets/AppIcon.appiconset` is still empty.

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
