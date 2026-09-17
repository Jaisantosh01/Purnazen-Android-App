# Running the patient app on the iOS Simulator (macOS)

Companion to [RUNNING.md](RUNNING.md), which covers the Android path on Windows.
This is the **iOS / macOS** path for `mobile-users`, start to finish: backend,
database, Metro, build, install, log in.

Verified on macOS 26.6 (Darwin 25.6.0), Xcode 26, Apple Silicon, Node 26,
Python 3.14.7, React Native 0.85.3 / Expo SDK 56.

> Everything below assumes the repo root at `PurnaZen_Android_App/`.

---

## 0. Prerequisites

| Tool | Notes |
|---|---|
| **Xcode** | Full install (not just Command Line Tools) + an iOS Simulator runtime |
| **Homebrew** | For PostgreSQL |
| **Node** | 22 LTS or newer |
| **Ruby + Bundler** | `bundle` is used for CocoaPods — the repo pins versions in `mobile-users/Gemfile` |
| **Python** | 3.12–3.14. 3.14 works; all wheels including `psycopg2-binary` resolve |

---

## 1. The port 5000 problem (read this first)

**macOS runs an AirPlay Receiver on port 5000.** The backend's default port is
also 5000. If you skip this, the app talks to AirPlay instead of your backend
and every request fails with a bare **403 Forbidden**:

```console
$ curl -i http://localhost:5000/health
HTTP/1.1 403 Forbidden
Server: AirTunes/960.13.1        # ← not the backend
```

Confirm who holds the port:

```bash
lsof -iTCP:5000 -sTCP:LISTEN -n -P
# ControlCe  418  jai  ...  TCP *:5000 (LISTEN)   ← AirPlay Receiver
```

Pick one:

- **Run the backend on 5001** (used throughout this guide). No system changes;
  the app is pointed at it with a git-ignored `.env` in step 4.
- **Free port 5000** — System Settings → General → AirDrop & Handoff → turn off
  **AirPlay Receiver**. Then use 5000 everywhere below and skip the `.env` file,
  since `src/config/index.js` already defaults to `http://localhost:5000`.

---

## 2. Database (PostgreSQL)

The backend defaults to `postgresql://postgres:sneha1234@localhost:5432/Wellness_db_v1`
(`backend/app/core/config.py`). Create exactly that and no backend config is needed.

```bash
brew install postgresql@16
brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"   # add to ~/.zshrc to persist

# wait until it accepts connections
until pg_isready -h localhost -p 5432 >/dev/null 2>&1; do sleep 1; done

# Homebrew's cluster has no `postgres` role by default — create it
psql -d postgres -c "CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'sneha1234';"
psql -d postgres -c 'CREATE DATABASE "Wellness_db_v1" OWNER postgres;'
```

Verify with the exact URL the backend uses:

```bash
psql "postgresql://postgres:sneha1234@localhost:5432/Wellness_db_v1" \
  -tAc "select current_user, current_database();"
# postgres|Wellness_db_v1
```

> Unlike the Android guide, **don't** substitute SQLite here — this flow runs
> `alembic upgrade head`, and those migrations are Postgres-only.

---

## 3. Backend

```bash
cd backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
./venv/bin/alembic upgrade head
./venv/bin/python seed.py
```

### 3.1 Remove MediaPipe on macOS

`app/main.py`'s lifespan pre-warms the MediaPipe FaceLandmarker at startup. On
macOS it selects the Metal backend and **aborts the process natively**:

```
F0000 graph_service.h:139] Check failed: service_ Service is unavailable.
    @ -[DrishtiMetalHelper initWithCalculatorContext:]
```

The abort happens on a MediaPipe worker thread, so the `try/except` around the
pre-warm cannot catch it — the interpreter never regains control and uvicorn
dies before serving anything. The Docker image is Linux, where this path isn't
taken, so this is macOS-local only.

`app/ai/face_detector.py` already degrades gracefully when the package is
missing, and the pre-warm handles *that* exception. So uninstall it from the venv:

```bash
./venv/bin/pip uninstall -y mediapipe
```

**Trade-off:** face-scan endpoints return "AI packages not installed". Everything
else — auth, doctors, appointments, sessions — works normally. No repo code changes.

### 3.2 Start it

```bash
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 5001
```

Verify — and check the `server:` header to be sure it isn't AirPlay answering:

```bash
curl -i http://localhost:5001/health        # server: uvicorn / {"status":"ok"}
curl -s -X POST http://localhost:5001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sneha@test.com","password":"123456"}'
```

---

## 4. Point the app at the backend

Skip this **only** if you freed port 5000 in step 1.

```bash
cd mobile-users
echo "EXPO_PUBLIC_API_URL=http://localhost:5001" > .env   # git-ignored
```

The iOS Simulator shares the host network, so `localhost` works directly — no
`10.0.2.2` alias or `adb reverse` like Android needs.

> Expo **inlines** `EXPO_PUBLIC_*` into the bundle at build time. Creating or
> editing `.env` requires a Metro restart with `--reset-cache` (step 5) — a
> plain reload will silently keep the old value.

---

## 5. Metro

```bash
cd mobile-users
npx react-native start --port 8081 --reset-cache
```

Leave it running. Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/status` → `200`.

---

## 6. Pods

Only needed on first run, or after changing `Podfile` / native dependencies.

```bash
cd mobile-users/ios
bundle install          # once
bundle exec pod install
```

⚠️ **Never `rm -rf mobile-users/ios/build`.** Codegen output lives in
`build/generated/ios`, and deleting it breaks the next build with
`error: The file "AsyncStorageSpec.h" couldn't be opened`. Re-run
`bundle exec pod install` to regenerate it.

> The `Podfile` sets `ENV['USE_FRAMEWORKS']` and `ENV['RCT_USE_PREBUILT_RNCORE']='0'`
> before `use_frameworks!`. Both are load-bearing for the Firebase pods to
> compile — the comments in the file explain why. Building React Native from
> source makes the first build slow; incremental builds are unaffected.

---

## 7. Build, install, launch

```bash
cd mobile-users/ios

# pick a simulator
xcrun simctl list devices available | grep iPhone

DEVICE="iPhone 17 Pro"
xcrun simctl boot "$DEVICE"
xcrun simctl bootstatus "$DEVICE" -b
open -a Simulator

xcodebuild -workspace wellness.xcworkspace \
           -scheme wellness \
           -configuration Debug \
           -sdk iphonesimulator \
           -destination "name=$DEVICE" \
           -derivedDataPath build

xcrun simctl install "$DEVICE" build/Build/Products/Debug-iphonesimulator/wellness.app
xcrun simctl launch  "$DEVICE" com.purnazen
```

Xcode works too: open `wellness.xcworkspace` (**not** `.xcodeproj`), pick the
`wellness` scheme and a simulator, press ⌘R.

---

## 8. Log in

Accounts created by `backend/seed.py`:

| Role | Email | Password |
|---|---|---|
| Patient | `sneha@test.com` | `123456` |
| Patient | `arjun@test.com` | `123456` |
| Patient | `meera@test.com` | `123456` |
| Doctor | `sarah@example.com`, `rajesh@example.com`, `priya@example.com` | `123456` |
| Admin | `admin@example.com` | `admin123` |

The patient accounts are the ones for `mobile-users`.

> The `demo@purnazen.com / demo1234` pair in the top-level `README.md` does not
> exist — no seed script creates it.

---

## 9. Day-to-day loop

Once set up, a normal session is just:

```bash
brew services start postgresql@16
cd backend && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 5001 &
cd mobile-users && npx react-native start --port 8081 &
xcrun simctl boot "iPhone 17 Pro" && open -a Simulator
xcrun simctl launch "iPhone 17 Pro" com.purnazen
```

JS edits hot-reload through Metro. You only need `xcodebuild` again after
changing native code, the `Podfile`, or adding a dependency.

### Shutting down

```bash
pkill -f "uvicorn app.main:app"
pkill -f "cli.js start"                  # Metro
brew services stop postgresql@16
xcrun simctl shutdown "iPhone 17 Pro"
osascript -e 'tell application "Simulator" to quit'
```

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **"Access Forbidden" / 403 in the app** | Talking to AirPlay on port 5000. See step 1. |
| **Backend exits at startup, `Check failed: service_`** | MediaPipe on macOS. See step 3.1. |
| **`.env` change had no effect** | Expo inlines it at build time — restart Metro with `--reset-cache`. |
| **`"purnazen" has not been registered`** | `withModuleName` in `ios/wellness/AppDelegate.swift` must match `name` in `app.json`. |
| **`No Firebase App '[DEFAULT]' has been created`** | `FirebaseApp.configure()` must run in `AppDelegate` *before* React Native starts — `crashReporting.js` touches Crashlytics while `index.js` is still evaluating. |
| **`Could not get GOOGLE_APP_ID`** | `ios/wellness/GoogleService-Info.plist` missing, or not in the target's Copy Bundle Resources. |
| **`error: include of non-modular header inside framework module 'RNFBApp...'`** | `ENV['USE_FRAMEWORKS']` / `RCT_USE_PREBUILT_RNCORE` missing from the `Podfile`, or stale pods — re-run `bundle exec pod install`. |
| **`RCT_EXPORT_METHOD ... type specifier missing`** | Same root cause as the row above. `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES` also causes it and must stay off. |
| **`The file "AsyncStorageSpec.h" couldn't be opened`** | `ios/build/generated` was deleted. Re-run `bundle exec pod install`. |
| **Metro `EADDRINUSE :::8081`** | Another Metro is already running: `lsof -iTCP:8081 -sTCP:LISTEN -n -P`, then kill it. |
