# Running Purnazen locally (backend + Android apps)

A step-by-step guide to run the FastAPI backend and the **three** React Native
apps on an Android emulator **or a physical device**. Verified on Windows 11
(PowerShell). macOS/Linux notes are called out where they differ.

## The three front-end apps

All three are bare RN apps (Expo SDK 56 / RN 0.85) that share the one backend.
Each pins its own Metro / dev-server port so they can run **side by side**
without colliding on 8081:

| App | Folder | `applicationId` | Metro port | Launch activity |
|---|---|---|---|---|
| Patient | `mobile-users`   | `com.purnazen`        | **8081** | `com.purnazen/.MainActivity` |
| Doctor  | `mobile-doctors` | `com.purnazen.doctor` | **8082** | `com.purnazen.doctor/.MainActivity` |
| Admin   | `mobile-admin`   | `com.purnazen.admin`  | **8083** | `com.purnazen.admin/.MainActivity` |

The port is baked into each debug build via `reactNativeDevServerPort` in
`<app>/android/gradle.properties` and matched by the `start` / `android` npm
scripts — so `npm start` and `npm run android` "just work" per app. Because the
`applicationId`s differ, **all three can be installed on one device at once**.

> Replace `<app>`, the port, and the package id in any command below with the
> row for the app you're running.

---

## 0. Prerequisites (install once)

| Tool | Version used | Notes |
|---|---|---|
| **Node.js** | 22 LTS recommended | 23.x works but is outside RN 0.85's supported engines |
| **JDK** | 17 or 21 (Temurin) | RN 0.85 / Gradle 9 need JDK 17+. JDK 21 confirmed working |
| **Python** | 3.13 / 3.14 | For the backend venv |
| **Android SDK** | Platform 36, Build-tools 36, Platform-tools, Emulator, cmdline-tools | Installed via Android Studio or `cmdline-tools` |
| **A system image** | `system-images;android-36;google_apis;x86_64` | For the emulator AVD |

You do **not** need Android Studio's GUI to run the app — the SDK command-line
tools (`sdkmanager`, `avdmanager`, `emulator`, `adb`) are enough.

### 0.1 Wire up the Android SDK environment (once)

The SDK on this machine lives at `C:\Android\Sdk`. Set `ANDROID_HOME` and add the
tool folders to `PATH` so `adb`, `emulator`, `sdkmanager`, `avdmanager` resolve.

PowerShell (persist for your user — takes effect in **new** shells):

```powershell
setx ANDROID_HOME      "C:\Android\Sdk"
setx ANDROID_SDK_ROOT  "C:\Android\Sdk"
# Add to PATH (User scope) — restart the terminal afterwards:
#   C:\Android\Sdk\platform-tools
#   C:\Android\Sdk\emulator
#   C:\Android\Sdk\cmdline-tools\latest\bin
```

Verify (new terminal):

```powershell
adb version
sdkmanager --list_installed
```

macOS/Linux equivalent (add to `~/.zshrc` / `~/.bashrc`):

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"   # or wherever the SDK is
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

### 0.2 Install SDK packages (only if missing)

```powershell
sdkmanager "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" "system-images;android-36;google_apis;x86_64"
sdkmanager --licenses    # accept all
```

### 0.3 Create an emulator (AVD) (once)

```powershell
# answer "no" to the custom-hardware-profile prompt
avdmanager create avd -n Pixel_API_36 -k "system-images;android-36;google_apis;x86_64" -d pixel_7
emulator -list-avds      # should list Pixel_API_36
```

### 0.4 Windows: enable long paths (REQUIRED for native builds)

RN 0.85's C++ codegen produces object-file paths well over Windows' legacy
260-character limit. Without long-path support the `:app:buildCMakeDebug` (ninja)
task fails with:

```
ninja: error: Stat(...RNGestureHandlerDetectorShadowNode.cpp.o): Filename longer than 260 characters
```

Enable it **once**, in an **elevated** PowerShell, then **reboot**:

```powershell
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' `
  -Name LongPathsEnabled -Value 1 -Type DWord
git config --global core.longpaths true
```

Verify after reboot: `(Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem').LongPathsEnabled` → `1`.

> Renaming a folder to a shorter name does **not** help — the limit is hit by the
> *internal* codegen path, not the project folder name. Long-path support (or
> moving the whole repo to a very short root like `C:\pz`) is the real fix.

---

## 1. Backend (FastAPI) — port 5000

```powershell
cd backend
python -m venv venv                 # once
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt     # once (or after dependency changes)
```

### 1.1 Choose a database

`backend/.env` ships pointing at PostgreSQL
(`DATABASE_URL=postgresql://...:5433/wellness_db`). Two options:

- **PostgreSQL (matches production):** start your Postgres on the configured
  port, then apply migrations:
  ```powershell
  python -m alembic upgrade head
  python seed.py        # demo doctors, sessions, etc.
  ```

- **SQLite (zero-setup local dev — recommended for a quick run):** override the
  DB URL for the session. ⚠️ **Do not run `alembic upgrade head` for SQLite** —
  the migrations were autogenerated for Postgres and hard-code the `now()`
  default, which SQLite can't evaluate on INSERT. Instead let `seed.py` build the
  schema (it calls `Base.metadata.create_all()`, which is dialect-aware):
  ```powershell
  $env:DATABASE_URL = "sqlite:///./wellness.db"
  python seed.py        # creates tables (create_all) AND seeds demo data
  ```
  If you want a clean reset, delete `backend\wellness.db` and re-run `seed.py`.

### 1.2 Run the server

```powershell
# if you used the SQLite override, set it again in this shell:
$env:DATABASE_URL = "sqlite:///./wellness.db"
python run.py                                   # uvicorn + reload, port 5000
# or without reload:
# python -m uvicorn app.main:app --host 0.0.0.0 --port 5000
```

Verify:

```powershell
curl http://localhost:5000/health            # {"status":"ok"}
curl http://localhost:5000/api/v1/doctors    # {"success":true,"data":{"doctors":[...]}}
```

Interactive API docs: <http://localhost:5000/apidocs> (Swagger) and `/redoc`.

**Demo login** (from `seed.py`): check the seeded users in `backend/seed.py` for
email/password to log in from the app.

### 1.3 Updating an existing DB / merging branched migrations

When you already have a populated DB and pull new work, just apply the new
migrations — **you do not need to drop and reseed**:

```powershell
python -m alembic current   # what the DB is on now
python -m alembic heads     # what the latest migration(s) are
python -m alembic upgrade head
```

If `upgrade head` fails with **"Multiple head revisions are present for given
argument 'head'"**, the migration history has *branched*: two or more feature
branches each created migrations off the same parent revision (common right
after a git merge of parallel feature branches). Symptom in the app: API calls
500 because the backend ORM references tables/columns whose migrations were
never applied to your DB. Inspect the tree:

```powershell
python -m alembic heads     # lists every head, e.g. 3 of them
python -m alembic history   # shows the tree; look for the "(branchpoint)" line
```

Fix it by creating a **merge migration** that joins all heads into one, then
upgrade. This is non-destructive — it adds an empty revision that ties the
branches together; your data is untouched:

```powershell
python -m alembic merge -m "merge <branch-a>, <branch-b>, <branch-c> branches" heads
python -m alembic upgrade head
```

Then verify a single head that matches the DB:

```powershell
python -m alembic heads     # should print exactly one "(head)"
python -m alembic current   # should equal that head, tagged "(mergepoint)"
```

Commit the generated merge file in `backend/alembic/versions/` so the rest of
the team gets the same linear-from-here history.

> SQLite note: the branched-history merge above can't be applied on SQLite
> because the per-revision migrations hard-code Postgres' `now()` (§1.1). On
> SQLite, delete `wellness.db` and re-run `seed.py` instead.

---

## 2. Frontend (any of the three RN apps)

The steps below work for **all three apps** — substitute the folder, port, and
package id from the table in [The three front-end apps](#the-three-front-end-apps).
The examples use the doctor app (`mobile-doctors`, port 8082); swap in
`mobile-users` (8081) or `mobile-admin` (8083) as needed.

```powershell
cd mobile-doctors                    # or mobile-users / mobile-admin
npm install                          # once per app (or after dependency changes)
```

### 2.1 Point the app at the backend

The API base URL is `BASE_URL` in `<app>/src/config/index.js`:

```js
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
```

> ⚠️ **`react-native start` does NOT load `.env`.** Only `expo start` / `expo`
> bundling injects `EXPO_PUBLIC_*` vars. Since these apps are launched with
> `react-native start` / `run-android`, `process.env.EXPO_PUBLIC_API_URL` is
> `undefined` at bundle time and **the fallback string after `||` is what
> actually ships**. So to change the dev API URL, edit that fallback (or switch
> to `expo start`) — editing `.env` alone has no effect here. All three apps now
> default to `http://localhost:5000`.

Pick the value that matches how the device/emulator reaches your PC:

| Setup | `BASE_URL` fallback | Requires |
|---|---|---|
| **USB device or emulator** (recommended, default) | `http://localhost:5000` | `adb reverse tcp:5000 tcp:5000` (§2.3) |
| Emulator only, no adb reverse | `http://10.0.2.2:5000` | — (`10.0.2.2` = emulator's host loopback) |
| Physical device over Wi-Fi (no cable) | `http://<your-PC-LAN-IP>:5000` | backend on `0.0.0.0` (it is) + firewall allows 5000 |

On a **physical device, `10.0.2.2` does NOT work** (it's an emulator-only alias)
— a wrong `BASE_URL` here is the most common "can't login / network error" cause.
After changing it, **reload the app** (Metro serves the new bundle; no native
rebuild needed for a JS-only change).

### 2.2 Tell Gradle where the SDK is

Create `mobile-users/android/local.properties` (git-ignored):

```properties
sdk.dir=C\:\\Android\\Sdk
```

(macOS/Linux: `sdk.dir=/Users/you/Library/Android/sdk`.)

### 2.3 Boot the emulator **or** plug in a device, then set adb reverse

Emulator:

```powershell
emulator -avd Pixel_API_36 -no-snapshot-load
adb wait-for-device
adb shell getprop sys.boot_completed     # prints 1 when ready
```

Physical device: enable USB debugging and plug it in — see
[§8 Physical device workflow](#8-physical-device-workflow-usb--adb). Confirm with
`adb devices` (one entry, state `device`).

Then forward the backend port **and this app's Metro port** so the device/emulator
can reach your PC. `run-android` auto-reverses the Metro port, but the backend
port (5000) you always set yourself:

```powershell
adb reverse tcp:5000 tcp:5000            # backend (shared by all apps)
adb reverse tcp:8082 tcp:8082            # this app's Metro port (8081 users / 8082 doctors / 8083 admin)
adb reverse --list                       # verify
```

### 2.4 Start Metro, then build & install

The npm scripts already pin the correct port. In one terminal:

```powershell
cd mobile-doctors
npm start                                # = react-native start --port 8082
# (add -- --reset-cache after a dependency/.env change)
```

In a second terminal:

```powershell
cd mobile-doctors
npm run android                          # = react-native run-android --port 8082
```

This Gradle-builds the debug APK, installs it (the differing `applicationId`
means it sits alongside the other apps), and launches it. **The first build is
slow**; subsequent builds are much faster.

> - Started Metro yourself? Add `--no-packager`: `npm run android -- --no-packager`.
> - Physical device is `arm64-v8a`, so do **not** use the x86_64-only build trick
>   (§6) — that produces an APK the phone can't run.
> - Running more than one app at once just means one Metro per port (8081/8082/8083)
>   and one `adb reverse` per port; they don't interfere.

---

## 3. Stopping everything

Run these in any order — all processes are safe to force-kill:

```powershell
# Stop the backend (port 5000)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000 -State Listen).OwningProcess -Force -ErrorAction SilentlyContinue

# Stop every Metro instance (ports 8081 / 8082 / 8083)
@(8081,8082,8083) | ForEach-Object {
    Stop-Process -Id (Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue
}

# Stop the emulator (graceful shutdown via adb, then force if needed)
C:\Android\Sdk\platform-tools\adb.exe emu kill
# If adb emu kill isn't enough:
Get-Process -Name "emulator","qemu-system-x86_64" -ErrorAction SilentlyContinue | Stop-Process -Force

# Confirm everything is gone
@(5000,8081,8082,8083) | ForEach-Object {
    $c = Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue
    if ($c) { "PORT $_ still in use by PID $($c.OwningProcess)" } else { "PORT $_ free" }
}
adb devices   # should list no devices / emulator
```

---

## 4. Useful commands

```powershell
adb devices                              # list running emulators/devices
adb reverse tcp:5000 tcp:5000            # backend: forward device:5000 → host:5000 (lets localhost:5000 work)
adb reverse tcp:8082 tcp:8082            # Metro for the app you're running (8081/8082/8083)
adb logcat *:S ReactNative:V ReactNativeJS:V   # app JS logs (all RN apps)
cd <app>; npm test                       # jest
cd <app>; npx tsc --noEmit               # type-check
cd backend; .\venv\Scripts\python.exe -m pytest -q   # backend tests

# Launch / stop a specific app by package id:
adb shell am start -n com.purnazen.doctor/.MainActivity   # doctor (com.purnazen / com.purnazen.admin for the others)
adb shell am force-stop com.purnazen.doctor
```

---

## 5. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| `adb` / `emulator` / `sdkmanager` "not recognized" | `ANDROID_HOME` / `PATH` not set — see §0.1, open a **new** terminal |
| Backend `/api/v1/doctors` → `{"success":false,"message":"Something went wrong"}` | Stale build before the model-registry fix, **or** the DB has no tables — re-run `seed.py` |
| `sqlite3.OperationalError: unknown function: now()` while seeding | You ran `alembic upgrade head` on SQLite. Delete `wellness.db` and use `seed.py` only (§1.1) |
| `alembic upgrade head` → **"Multiple head revisions are present for given argument 'head'"** | Two+ feature branches each added migrations off the same parent, so the history has several heads. **Don't reset the DB** — merge the heads and upgrade. See **[§1.3 Updating an existing DB / merging branched migrations](#13-updating-an-existing-db--merging-branched-migrations)** |
| `FATAL: database "wellness_db" does not exist` on backend startup | Database was never created — run `createdb` once: `$env:PGPASSWORD="<your password>"; & "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U <your username> -h localhost -p 5432 -O <your username> wellness_db` |
| Backend can't connect to DB on startup | Postgres isn't running on the `.env` port — use the SQLite override (§1.1) |
| App shows network errors / can't login / can't reach API | Wrong `BASE_URL` for your setup (§2.1). **Physical device + `10.0.2.2` never works.** Use `http://localhost:5000` + `adb reverse tcp:5000 tcp:5000`, or the PC's LAN IP. Editing `.env` alone does nothing under `react-native start` — change the `||` fallback in `src/config/index.js`, then **reload** |
| Red screen "Unable to load script / could not connect to development server" | Metro isn't running on the port this app expects, or the reverse is missing. Start Metro with the app's `npm start` (8081/8082/8083) and run `adb reverse tcp:<port> tcp:<port>`. The baked port lives in `<app>/android/gradle.properties` (`reactNativeDevServerPort`) |
| Two apps fight over Metro / "port 8081 already in use" | Each app has its own port (8081/8082/8083) via its npm scripts — make sure you ran `npm start` **inside the right app folder**, not a bare `react-native start` (which defaults to 8081) |
| `ninja: error: ... Filename longer than 260 characters` | Windows long paths not enabled — see [§0.4](#04-windows-enable-long-paths-required-for-native-builds). Renaming the app folder does **not** fix it |
| Gradle: `SDK location not found` | Create `<app>/android/local.properties` (§2.2) or set `ANDROID_HOME` |
| `JAVA_HOME` / wrong JDK | Use JDK 17 or 21. `java -version` should show 17+ |
| Port 5000 already in use | `Get-NetTCPConnection -LocalPort 5000` then `Stop-Process -Id <pid>` |
| Metro stale cache (after `.env` / dep change) | `npm start -- --reset-cache` in the app folder |
| App installs but won't run / "INSTALL_FAILED_NO_MATCHING_ABIS" on the emulator | The build's native libs don't match the emulator's CPU. `app/build.gradle` must **not** hard-pin `ndk { abiFilters "arm64-v8a" }`. Leave ABIs to the `reactNativeArchitectures` property |
| `'gradlew.bat' is not recognized` from `npx react-native run-android` | Run the wrapper directly: `cd <app>/android && .\gradlew.bat app:installDebug`, then launch with `adb shell am start -n <applicationId>/.MainActivity` |
| First build is very slow / emulator only | Build only the emulator's ABI: `.\gradlew.bat app:installDebug -PreactNativeArchitectures=x86_64`. **Physical device is arm64 — use `arm64-v8a` instead** |

---

## 6. Quick reference — full run from scratch (Postgres)

> Prerequisites: PostgreSQL 18 running on port 5432, role `<your username>` (password `<your password>`).
> One-time DB creation: `$env:PGPASSWORD="<your password>"; & "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U <your username> -h localhost -p 5432 -O <your username> wellness_db`

```powershell
# Terminal A — backend
cd backend
.\venv\Scripts\Activate.ps1
# First time (or after DB reset):
python -m alembic upgrade head
python seed.py
# Run:
python run.py              # uvicorn + reload, port 5000

# Terminal B — emulator + Metro
emulator -avd Pixel_API_36 -no-snapshot-load
cd mobile-users
npx react-native start --reset-cache

# Terminal C — build & install
cd mobile-users
# Set adb reverse (lets emulator reach host ports):
C:\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
C:\Android\Sdk\platform-tools\adb.exe reverse tcp:5000 tcp:5000
# Build (x86_64 only = ~3 min):
cd android
.\gradlew.bat app:installDebug -PreactNativeArchitectures=x86_64
C:\Android\Sdk\platform-tools\adb.exe shell monkey -p com.purnazen -c android.intent.category.LAUNCHER 1
```

## 7. Quick reference — full run from scratch (SQLite)

```powershell
# Terminal A — backend
cd backend
.\venv\Scripts\Activate.ps1
$env:DATABASE_URL = "sqlite:///./wellness.db"
python seed.py            # first time / after reset
python run.py

# Terminal B — emulator + Metro
emulator -avd Pixel_API_36 -no-snapshot-load
cd mobile-users
npx react-native start --reset-cache

# Terminal C — build & install
cd mobile-users
npx react-native run-android --no-packager
```

---

## 8. Physical device workflow (USB + adb)

Running on a real Android phone instead of the emulator. Everything below uses
`adb` directly so you can install, launch, screenshot, and re-deploy without
Android Studio. The app's package id is **`com.purnazen`** and its launchable
activity is **`com.purnazen/.MainActivity`**.

### 8.1 One-time device setup

1. On the phone: **Settings → About phone → tap "Build number" 7×** to unlock
   Developer options.
2. **Settings → System → Developer options →** enable **USB debugging** (and
   **Install via USB** on some OEMs like Xiaomi/Oppo).
3. Plug the phone into the PC over USB. The phone shows an **"Allow USB
   debugging?"** prompt — tick *Always allow from this computer* and accept.
4. Confirm the PC sees it:

```powershell
adb devices -l
# List of devices attached
# <SERIAL>   device  product:... model:... device:...
```

If it shows `unauthorized`, re-accept the on-phone prompt. If it shows nothing,
try a different cable/port (some cables are charge-only) and `adb kill-server; adb start-server`.

> **Multiple devices attached?** Every `adb` command below takes `-s <SERIAL>`
> to target one device, e.g. `adb -s 1A2B3C4D shell ...`. Get `<SERIAL>` from
> `adb devices`. With a single device you can omit `-s`.

### 8.2 Let the device reach the backend

The phone's `localhost` is *itself*, not your PC. Two options:

- **`adb reverse` (simplest, USB only):** forward the device's ports to the PC,
  then the app can use the default `http://10.0.2.2:5000`/`localhost:5000`-style
  base URL over the cable:
  ```powershell
  adb reverse tcp:5000 tcp:5000      # device:5000  → PC:5000 (backend)
  adb reverse tcp:8081 tcp:8081      # device:8081  → PC:8081 (Metro, debug builds)
  ```
  `adb reverse` is cleared on unplug/reboot — re-run after reconnecting.
  Set `EXPO_PUBLIC_API_URL=http://localhost:5000` in `mobile-users/.env` for this path.
- **LAN IP (no cable needed at runtime):** put your PC's Wi-Fi IP in
  `mobile-users/.env` (`EXPO_PUBLIC_API_URL=http://192.168.x.y:5000`) and make sure
  the backend binds `0.0.0.0` (it does — see `run.py`) and your firewall allows
  inbound 5000. Rebuild after editing `.env` (it's inlined at bundle time).

### 8.3 Build & install (inject) the APK

```powershell
# Easiest: build, install on the connected device, and launch in one step
cd mobile-users
npx react-native run-android --no-packager   # start Metro yourself first (§2.4)

# Or build the APK by hand and push it with adb:
cd mobile-users/android
.\gradlew.bat assembleDebug                   # → app/build/outputs/apk/debug/app-debug.apk
adb install -r app\build\outputs\apk\debug\app-debug.apk   # -r = replace/keep data
#   -r  reinstall keeping data   -d  allow downgrade   -t  allow test APKs
```

A physical phone is usually `arm64-v8a`, so (unlike the x86_64 emulator) **don't**
restrict the build to x86_64. Build all ABIs, or target the device's ABI:

```powershell
adb shell getprop ro.product.cpu.abi          # e.g. arm64-v8a
.\gradlew.bat assembleDebug -PreactNativeArchitectures=arm64-v8a
```

### 8.4 Launch / stop / clear

```powershell
# Launch the app's main activity
adb shell am start -n com.purnazen/.MainActivity
#   alt: adb shell monkey -p com.purnazen -c android.intent.category.LAUNCHER 1

# Force-stop (kill) the app
adb shell am force-stop com.purnazen

# Clear all app data (logout, reset onboarding, wipe local DB/keystore cache)
adb shell pm clear com.purnazen

# Uninstall completely
adb uninstall com.purnazen
```

### 8.5 Take a screenshot (and screen recording)

```powershell
# Screenshot straight to the PC (no temp file on the phone)
adb exec-out screencap -p > screenshot.png

# Or capture on device, then pull it off
adb shell screencap -p /sdcard/shot.png
adb pull /sdcard/shot.png .\shot.png
adb shell rm /sdcard/shot.png

# Screen recording (Ctrl-C to stop, max ~3 min per file)
adb shell screenrecord /sdcard/demo.mp4
adb pull /sdcard/demo.mp4 .\demo.mp4
```

### 8.6 Relaunch / update after a code change

- **JS-only change (debug build, Metro running):** just **shake the device →
  Reload**, or push a reload over adb:
  ```powershell
  adb shell input text "RR"          # double-R reload (RN dev menu shortcut)
  # open the dev menu instead:
  adb shell input keyevent 82
  ```
- **Native change, or to redeploy the whole app:** rebuild & reinstall, then
  relaunch:
  ```powershell
  cd mobile-users/android
  .\gradlew.bat assembleDebug
  adb install -r app\build\outputs\apk\debug\app-debug.apk
  adb shell am force-stop com.purnazen
  adb shell am start -n com.purnazen/.MainActivity
  ```

### 8.7 Logs from the device

```powershell
adb logcat *:S ReactNative:V ReactNativeJS:V       # app JS logs only
adb logcat --pid=$(adb shell pidof -s com.purnazen)  # everything from the app process
adb logcat -c                                       # clear the log buffer first
```

### 8.8 Wireless debugging (Android 11+, optional)

Pair once over USB, then unplug and debug over Wi-Fi:

```powershell
adb tcpip 5555                       # restart adbd on TCP (device still plugged in)
adb shell ip route                   # find the device's Wi-Fi IP (wlan0)
adb connect 192.168.x.y:5555         # now you can unplug the cable
adb devices                          # shows 192.168.x.y:5555  device
```

(Re-run `adb reverse` after connecting wirelessly if you use the reverse-tunnel
backend path — though over pure Wi-Fi the LAN-IP base URL is simpler.)
