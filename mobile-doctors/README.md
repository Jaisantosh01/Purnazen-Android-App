# Purnazen for Doctors (`mobile-doctors`)

Doctor-facing React Native app — **scaffolded skeleton**. It mirrors the patient
app's stack and infrastructure (`mobile-users`) and talks to the **same FastAPI
backend**, but ships placeholder screens for the doctor workflows rather than
finished features.

> Status: partially built. Auth + navigation + service layer are real, and
> **Profile & Settings are at full parity with the patient app** — dark mode,
> biometric login, themed alerts, editable profile/phone/password, language,
> check-for-updates, and profile trackers (today / upcoming / completed
> appointments). Remaining clinical feature screens still render a "scaffolded"
> placeholder documenting the intended behaviour and backend endpoint(s).

## Stack

Same as `mobile-users`: React Native 0.85 (bare + Expo modules, SDK 56),
React Navigation 7, Zustand, Axios, `react-native-keychain` for token storage.
Heavier patient-only deps (vision-camera, image-picker, video, svg) are omitted.

## Structure

```
mobile-doctors/
├── App.tsx                    # Auth gate + bottom tabs (Dashboard, Appointments,
│                              #   Schedule, Patients, Profile) + detail stacks
├── index.js, app.json         # RN entry / app name ("Purnazen Doctor")
├── babel/metro/jest/tsconfig  # Same toolchain as mobile-users
└── src/
    ├── api/client.js          # Axios instance: token attach + 401 silent refresh
    ├── config/index.js        # EXPO_PUBLIC_API_URL → BASE_URL
    ├── constants/
    │   ├── theme.js           # Tokens — clinical-blue primary (patient app is green)
    │   └── apiEndpoints.js    # Endpoints (some doctor-scoped ones are TODO on backend)
    ├── store/authStore.js     # Zustand auth state ({ doctor, isLoggedIn })
    ├── utils/
    │   ├── secureStorage.js   # Keystore tokens, namespaced com.purnazen.doctor.*
    │   └── toast.js           # Global toast store
    ├── navigation/navigationRef.js
    ├── services/              # authService + appointment / availability / patient (stubs)
    ├── components/            # Toast, ScreenHeader, Placeholder
    └── screens/               # Login, Dashboard, Appointments(+Detail),
                               #   Schedule, Patients(+Detail), Profile
```

## Setup

```powershell
cd mobile-doctors
npm install
```

`BASE_URL` is in `src/config/index.js` (`EXPO_PUBLIC_API_URL || 'http://localhost:5000'`).
Note `react-native start` does **not** load `.env` — the `||` fallback is what
ships in dev. `localhost:5000` works on a USB device/emulator with
`adb reverse tcp:5000 tcp:5000`; for an emulator without it use `http://10.0.2.2:5000`,
for a device over Wi-Fi use the PC's LAN IP. See [docs/RUNNING.md §2.1](../docs/RUNNING.md#21-point-the-app-at-the-backend).

### Native projects (android/ios)

To keep the skeleton lean this folder ships **JS/TS only** — no committed
`android/`/`ios/` native projects. Generate them once before the first run:

```powershell
npx expo prebuild          # expo is a dependency; generates android/ + ios/
```

(Alternatively, copy `mobile-users/android` + `mobile-users/ios` and rename the
application id / package from `com.wellness` to a doctor id, e.g.
`com.purnazen.doctor`.)

### Run

```powershell
npm start                  # Metro (in one terminal)
npm run android            # build + install (in another)
```

See the repo-root [docs/RUNNING.md](../docs/RUNNING.md) — the emulator, SDK and
`adb reverse` steps are identical to `mobile-users`.

### Tests / checks

```powershell
npm test                   # jest (auth store + endpoints smoke test)
npx tsc --noEmit           # type-check
npm run lint               # eslint
```

> CI: a `mobile-doctors` job isn't wired into `.github/workflows/ci.yml` yet —
> add one (mirroring the `mobile-users` `frontend` job) after the first
> `npm install` produces a `package-lock.json`.

## Doctor features (planned)

| Screen | Backend endpoint(s) |
|---|---|
| **Login** | `POST /api/v1/auth/login` (doctor accounts provisioned server-side) |
| **Dashboard** | summary counts (today / pending / patients) |
| **Appointments** + detail | `GET /appointments`, `PUT /appointments/:id` — *doctor-scoped list is a backend TODO* |
| **Schedule / availability** | `GET·POST /doctor-availability`, `PUT·DELETE /doctor-availability/:id` |
| **Patients** + detail | `GET /patients`, `GET /patients/:id`, `GET /patients/:id/face-glow/history` — *backend TODO* |
| **Profile** | `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password` |
