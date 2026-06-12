# Features Tracker

**Last updated:** 2026-06-12 (post P0 booking-funnel + therapy-history implementation, T1–T5)

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
| Register | (no screen yet) | `POST /api/v1/auth/register` | ⚠️ | Backend done + tested; no signup screen |
| Login | `LoginScreen` | `POST /api/v1/auth/login` | ✅ | Tokens + user persisted; Zustand synced |
| Logout | Profile menu | `POST /api/v1/auth/logout` | ✅ | Now revokes refresh token server-side |
| Token refresh | not wired | `POST /api/v1/auth/refresh` | ⚠️ | Backend done + tested; axios client doesn't auto-refresh on 401 yet |
| Current user | not wired | `GET /api/v1/auth/me` | ⚠️ | Backend done + tested |
| Admin dashboard | — | `GET /api/v1/auth/admin/dashboard` | ✅ | Role-gated, tested |
| Edit profile | SettingsScreen UI | — | 🎨 | Needs `PUT /api/v1/auth/me` |
| Change password | SettingsScreen UI | — | 🎨 | Needs endpoint |
| Delete account | SettingsScreen UI | — | 🎨 | Needs endpoint |

## Home

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Quick relief cards | `HomeScreen` | `GET /api/v1/home/quick-relief` | ✅ | End-to-end; tested |
| Wellness rows | `HomeScreen` | — | 🎨 | Hardcoded fallback list; no API call |

## Consultation

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Doctor list + search + pagination | `ConsultScreen` | `GET /api/v1/doctors` | ✅ | Tested (card shape, search, pagination) |
| Filter tabs (Today/Video/Home/Top) | `ConsultScreen` | — | 🎨 | Endpoints `/doctors/available-today` etc. missing |
| Doctor detail | `DoctorProfileScreen` | `GET /api/v1/doctors/:id` | ✅ | Card shape shared with list endpoint; 404 envelope; tested |
| Visit types | `BookAppointmentScreen` | `GET /api/v1/doctors/:id/visit-types` | ✅ | Derived from `consultation_types` m2m; fee from `consultation_fee`; tested |
| Time slots | `BookAppointmentScreen` | `GET /api/v1/doctors/:id/time-slots?date=` | ✅ | Generated from `doctor_availability`, minus booked appointments; seeded Mon–Sat; tested |
| Book appointment | `BookAppointmentScreen` | `POST /api/v1/appointments/book`, `GET /api/v1/appointments` | ✅ | `Appointment` model + migration; 409 on slot conflict; booking ref shown on confirmation screen; tested |
| Payment | `PaymentScreen` | — | 🎨 | No payment model/gateway — decorative |

## Wellness & Relief Sessions

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Session player (yoga/meditation/breathing) | `YogaSessionScreen` | — | 🎨 | Full player UI; content from local mock |
| Relief session player (acupressure) | `ReliefSessionScreen` | — | 🎨 | Full player UI; content from local mock |
| Session catalog API | services ready | — | ❌ | Needs `GET /api/v1/sessions`, `/relief-sessions` |
| Save completed session | called on completion | `POST /api/v1/therapy-history/save` | ✅ | `TherapySession` model + migration; auth-required; tested |
| Therapy history | `TherapyHistoryScreen` | `GET /api/v1/therapy-history` | ✅ | Live list + stats (sessions/minutes/avgRelief), paginated, newest first; mock removed |

## Other

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Face Glow routines | `FaceGlowScreen` | — | 🎨 | Scan button shows alert; endpoints defined, no backend |
| Subscriptions | `SubscriptionsScreen` | — | 🎨 | Static plans; no billing |
| Notifications | `NotificationsScreen` | — | 🎨 | Toggles are local-only; no push service |
| Help & Support | `HelpSupportScreen` | — | ✅ | External links only — no backend needed |
| Settings toggles | `SettingsScreen` | — | 🎨 | Not persisted |
| Health check | — | `GET /health` | ✅ | |

---

## Endpoint Scoreboard

| Category | Needed | Implemented | Gap |
|----------|--------|-------------|-----|
| Auth | 9 | 6 | profile update, change password, delete account |
| Home | 2 | 1 | wellness sessions list |
| Consult | 10 | 5 | filters (4), payment |
| Sessions/Relief | 4 | 0 | catalogs |
| Therapy | 2 | 2 | — |
| Face Glow | 4 | 0 | routines, scan, history |
| **Total** | **31** | **14** | **17** |

(Plus `GET /api/v1/appointments` — implemented as part of booking, not counted in "needed".)

---

## Priority Queue (backend work)

### P0 — Blocks core UX — ✅ all done 2026-06-12 (T1–T5)
1. ~~`GET /api/v1/doctors/:id` — doctor detail screen~~
2. ~~`GET /api/v1/doctors/:id/time-slots` + slot generation from `doctor_availability`~~
3. ~~`POST /api/v1/appointments/book` (+ `Appointment` model + migration)~~
4. ~~`POST /api/v1/therapy-history/save` + `GET /api/v1/therapy-history` (+ model)~~

### P1
5. Doctor filter endpoints (available-today / video-call / home-visit / top-rated)
6. `GET /api/v1/sessions` + `GET /api/v1/relief-sessions` catalogs (+ models, seed from `src/data/`)
7. `PUT /api/v1/auth/me`, change-password endpoint
8. Payment processing (Razorpay sandbox)

### P2
9. Registration screen (frontend)
10. Axios auto-refresh on 401 (use `REFRESH` endpoint, queue retries)
11. Subscriptions, notification preferences, face glow, account deletion

---

## Tech Debt Register

| Item | Severity | Notes |
|------|----------|-------|
| ~~Tokens in AsyncStorage~~ | ✅ Resolved 2026-06-12 | Now in device keystore via `react-native-keychain` (`src/utils/secureStorage.js`); legacy tokens auto-migrated on app start |
| ~~No rate limiting on auth~~ | ✅ Resolved 2026-06-12 | slowapi on login/register/refresh, per-IP, `RATE_LIMIT_*` env-configurable; Redis-backed when `REDIS_URL` set |
| ~~CORS `allow_origins=["*"]`~~ | ✅ Configurable 2026-06-12 | `CORS_ORIGINS` env var; default still `*` for dev — **set explicit origins in production .env** |
| Frontend tests thin | Medium | jest suite now runs (was broken); 2 suites / 6 tests (App render + secureStorage) — screens/services untested (→ T17) |
| Monolithic screens | Low | `src/constants/theme.js` tokens now exist; screen-by-screen migration pending (→ T16) |
| ~~`BottomNav.js` unused~~ | ✅ Deleted 2026-06-12 | Also deleted 7 unused `src/data/*.json` duplicates |
| ~~Hardcoded API IP/port~~ | ✅ Resolved 2026-06-12 | `EXPO_PUBLIC_API_URL` via `.env` → `src/config/index.js`; fallback `10.0.2.2:5000` |
| ~~`react-hooks/exhaustive-deps` errors~~ | ✅ Fixed 2026-06-12 | Were in `BookAppointmentScreen` (missing `doctor.id`); `eslint --quiet` now clean |
| Backend test coverage | Info | 52 tests cover all existing endpoints + rate limiting; extend with each new feature |
| HomeScreen renders empty text labels | Low | PR #1 emptied `<Text>` contents; `STRINGS` constants exist in `src/constants/strings.js` but aren't wired in (UI change — deliberately out of scope of the infra migration) |
