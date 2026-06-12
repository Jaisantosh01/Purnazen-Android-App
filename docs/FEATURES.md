# Features Tracker

**Last updated:** 2026-06-12 (post P1 feature-completeness implementation, T6–T11)

> Detailed, prioritized task breakdown of every gap below: **[TASKS.md](TASKS.md)** (T1–T19).

Single source of truth for what is built, what is stubbed, and what is missing — across frontend and backend.

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and working end-to-end |
| 🎨 | Frontend UI done, backend endpoint missing (mock-data fallback) |
| ⚠️ | Partial / needs attention |
| ❌ | Not started |

---

## Authentication

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Register | `RegisterScreen` | `POST /api/v1/auth/register` | ✅ | Validated form → register → auto-login → Main; linked from LoginScreen; jest-tested |
| Login | `LoginScreen` | `POST /api/v1/auth/login` | ✅ | Tokens + user persisted; Zustand synced |
| Logout | Settings menu | `POST /api/v1/auth/logout` | ✅ | Revokes refresh token server-side; resets nav to Login |
| Token refresh | axios interceptor | `POST /api/v1/auth/refresh` | ✅ | Silent refresh on 401, single-flight queue, logout+reset on refresh failure; jest-tested |
| Current user | authService | `GET /api/v1/auth/me` | ✅ | Now returns the full user profile |
| Admin dashboard | — | `GET /api/v1/auth/admin/dashboard` | ✅ | Role-gated, tested |
| Edit profile | SettingsScreen modal | `PUT /api/v1/auth/me` | ✅ | Updates name/avatar; store + cache synced |
| Change password | SettingsScreen modal | `POST /api/v1/auth/change-password` | ✅ | Wrong current → 401; revokes all old tokens (`token_version`); fresh pair stored |
| Delete account | SettingsScreen | `DELETE /api/v1/auth/me` | ✅ | Hard delete + cascade (appointments, therapy, payments); tokens die immediately |

## Home

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Quick relief cards | `HomeScreen` | `GET /api/v1/home/quick-relief` | ✅ | End-to-end; tested |
| Wellness rows | `HomeScreen` | — | 🎨 | Hardcoded fallback list; no API call (→ T12; can reuse `GET /sessions`) |

## Consultation

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Doctor list + search + pagination | `ConsultScreen` | `GET /api/v1/doctors` | ✅ | Tested (card shape, search, pagination) |
| Filter tabs (Today/Video/Home/Top) | `ConsultScreen` | `GET /doctors/available-today`, `/video-call`, `/home-visit`, `/top-rated` | ✅ | Server-filtered, same card shape + search/pagination; seed now links consultation types; tested |
| Doctor detail | `DoctorProfileScreen` | `GET /api/v1/doctors/:id` | ✅ | Card shape shared with list endpoint; 404 envelope; tested |
| Visit types | `BookAppointmentScreen` | `GET /api/v1/doctors/:id/visit-types` | ✅ | Derived from `consultation_types` m2m; fee from `consultation_fee`; tested |
| Time slots | `BookAppointmentScreen` | `GET /api/v1/doctors/:id/time-slots?date=` | ✅ | Generated from `doctor_availability`, minus booked appointments; seeded Mon–Sat; tested |
| Book appointment | `BookAppointmentScreen` | `POST /api/v1/appointments/book`, `GET /api/v1/appointments` | ✅ | `Appointment` model + migration; 409 on slot conflict; booking ref shown on confirmation screen; tested |
| Payment | `PaymentScreen` | `POST /api/v1/payments/process`, `/payments/verify` | ⚠️ | Full order→verify flow works (HMAC-verified; appointment marked paid); runs in local sandbox without keys. Razorpay checkout SDK for real test keys still open (native module) |

## Wellness & Relief Sessions

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Session player (yoga/meditation/breathing) | `YogaSessionScreen` | `GET /api/v1/sessions/:key` | ✅ | API content wins once fetched; local data kept as instant-render/offline fallback |
| Relief session player (acupressure) | `ReliefSessionScreen` | `GET /api/v1/relief-sessions/:key` | ✅ | Same pattern; keys with spaces ("Neck Pain") supported |
| Session catalog API | services ready | `GET /api/v1/sessions`, `/relief-sessions` | ✅ | `WellnessSession`/`ReliefSession` models, seeded from ported mock content; tested |
| Save completed session | called on completion | `POST /api/v1/therapy-history/save` | ✅ | `TherapySession` model + migration; auth-required; tested |
| Therapy history | `TherapyHistoryScreen` | `GET /api/v1/therapy-history` | ✅ | Live list + stats (sessions/minutes/avgRelief), paginated, newest first; mock removed |

## Other

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Face Glow routines | `FaceGlowScreen` | — | 🎨 | Scan button shows alert; endpoints defined, no backend (→ T13) |
| Subscriptions | `SubscriptionsScreen` | — | 🎨 | Static plans; no billing (→ T14) |
| Notifications | `NotificationsScreen` | — | 🎨 | Toggles are local-only; no push service (→ T15) |
| Help & Support | `HelpSupportScreen` | — | ✅ | External links only — no backend needed |
| Settings toggles | `SettingsScreen` | — | 🎨 | Account section is live (T8); notification/privacy toggles not persisted (→ T15) |
| Health check | — | `GET /health` | ✅ | |

---

## Endpoint Scoreboard

| Category | Needed | Implemented | Gap |
|----------|--------|-------------|-----|
| Auth | 9 | 9 | — |
| Home | 2 | 1 | wellness sessions list (can reuse `GET /sessions`) |
| Consult | 11 | 11 | — (incl. payments process + verify) |
| Sessions/Relief | 4 | 4 | — |
| Therapy | 2 | 2 | — |
| Face Glow | 4 | 0 | routines, scan, history |
| **Total** | **32** | **27** | **5** |

(Plus `GET /api/v1/appointments` — implemented as part of booking, not counted in "needed".)

---

## Priority Queue (backend work)

### P0 — Blocks core UX — ✅ all done 2026-06-12 (T1–T5)
1. ~~`GET /api/v1/doctors/:id` — doctor detail screen~~
2. ~~`GET /api/v1/doctors/:id/time-slots` + slot generation from `doctor_availability`~~
3. ~~`POST /api/v1/appointments/book` (+ `Appointment` model + migration)~~
4. ~~`POST /api/v1/therapy-history/save` + `GET /api/v1/therapy-history` (+ model)~~

### P1 — Feature completeness — ✅ all done 2026-06-12 (T6–T11)
5. ~~Doctor filter endpoints (available-today / video-call / home-visit / top-rated)~~
6. ~~`GET /api/v1/sessions` + `GET /api/v1/relief-sessions` catalogs (+ models, seed from `src/data/`)~~
7. ~~`PUT /api/v1/auth/me`, change-password, delete-account endpoints~~
8. ~~Payment processing (Razorpay sandbox; local sandbox mode without keys)~~
9. ~~Registration screen (frontend)~~
10. ~~Axios auto-refresh on 401~~

### P2 (→ T12–T19)
11. Wellness rows on Home from API; Face Glow backend; subscriptions; notification preferences; theme adoption; frontend test coverage; STRINGS wiring; CI. Plus: react-native-razorpay checkout for real test keys (needs Android SDK machine).

---

## Tech Debt Register

| Item | Severity | Notes |
|------|----------|-------|
| ~~Tokens in AsyncStorage~~ | ✅ Resolved 2026-06-12 | Now in device keystore via `react-native-keychain` (`src/utils/secureStorage.js`); legacy tokens auto-migrated on app start |
| ~~No rate limiting on auth~~ | ✅ Resolved 2026-06-12 | slowapi on login/register/refresh, per-IP, `RATE_LIMIT_*` env-configurable; Redis-backed when `REDIS_URL` set |
| ~~CORS `allow_origins=["*"]`~~ | ✅ Configurable 2026-06-12 | `CORS_ORIGINS` env var; default still `*` for dev — **set explicit origins in production .env** |
| ~~No auto-refresh on 401~~ | ✅ Resolved 2026-06-12 | Silent refresh + replay + single-flight queue in `src/api/client.js` (T10) |
| Frontend tests thin | Medium | 4 suites / 15 tests (App render, secureStorage, RegisterScreen, apiClient) — most screens/services still untested (→ T17) |
| Monolithic screens | Low | `src/constants/theme.js` tokens now exist; screen-by-screen migration pending (→ T16) |
| ~~`BottomNav.js` unused~~ | ✅ Deleted 2026-06-12 | Also deleted 7 unused `src/data/*.json` duplicates |
| ~~Hardcoded API IP/port~~ | ✅ Resolved 2026-06-12 | `EXPO_PUBLIC_API_URL` via `.env` → `src/config/index.js`; fallback `10.0.2.2:5000` |
| ~~`react-hooks/exhaustive-deps` errors~~ | ✅ Fixed 2026-06-12 | Were in `BookAppointmentScreen` (missing `doctor.id`); `eslint --quiet` now clean |
| Backend test coverage | Info | 79 tests cover all existing endpoints + rate limiting; extend with each new feature |
| Auth deps hit the DB per request | Info | `token_version` check fetches the user on every authed call (replaces unbounded-blocklist risk); cache in Redis if it ever shows up in profiles |
| HomeScreen renders empty text labels | Low | PR #1 emptied `<Text>` contents; `STRINGS` constants exist in `src/constants/strings.js` but aren't wired in (→ T18) |
