# Purnazen for Doctors (`mobile-doctors`)

Doctor-facing React Native app. It mirrors the patient app's stack and
infrastructure (`mobile-users`) and talks to the **same FastAPI backend**,
gated to the `doctor` role (`com.purnazen.doctor`, Metro port 8082).

> Status: **functional**. Real Dashboard (today's counts, pending requests,
> today's schedule from `GET /appointments/doctor`), Appointments (list +
> detail + status updates), Schedule (weekly availability CRUD), Patients
> (roster derived from the appointment feed + patient profile with visit
> history), and persisted clinical records (consultation notes / diagnosis /
> prescription via `/appointments/{id}/records`). Profile & Settings are at
> full parity with the patient app — dark mode, biometric login, themed
> alerts, editable profile/phone/password, language, check-for-updates, and
> profile trackers. Feature status: [../docs/FEATURES.md](../docs/FEATURES.md).

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

## Doctor features

| Screen | Backend endpoint(s) |
|---|---|
| **Login** | `POST /api/v1/auth/login` (doctor accounts provisioned server-side) |
| **Dashboard** | `GET /appointments/doctor` (today / pending / active patients + schedule) |
| **Appointments** + detail | `GET /appointments/doctor`, `PUT /appointments/:id` |
| **Schedule / availability** | `GET·POST /doctor-availability`, `PUT·DELETE /doctor-availability/:id` |
| **Patients** + profile | derived from the appointment feed + `GET /users/:id` (no separate patients table) |
| **Clinical records** | `GET/POST /appointments/:id/records`, `PUT/DELETE .../records/:recordId` |
| **Profile / Settings** | `GET/PUT /auth/me`, `POST /auth/logout`, `POST /auth/change-password`, `GET/PUT /users/me/preferences` |
