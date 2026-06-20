# Purnazen for Doctors (`mobile-doctors`)

Doctor-facing React Native app — **scaffolded skeleton**. It mirrors the patient
app's stack and infrastructure (`mobile-users`) and talks to the **same FastAPI
backend**, but ships placeholder screens for the doctor workflows rather than
finished features.

> Status: skeleton only. Auth + navigation + service layer are real; feature
> screens render a "scaffolded" placeholder that documents the intended
> behaviour and the backend endpoint(s) each will use.

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

Create `.env` (see `.env.example`):

```
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000   # emulator → host; device → LAN IP
```

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
