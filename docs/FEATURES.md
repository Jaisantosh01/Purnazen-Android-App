# Features Tracker

**Last updated:** 2026-06-12 (post FastAPI migration + tech-debt pass: rate limiting, Redis, keychain tokens)

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
| Doctor detail | `DoctorProfileScreen` | — | 🎨 | Needs `GET /api/v1/doctors/:id` |
| Visit types | `BookAppointmentScreen` | — | 🎨 | Model exists (`consultation_types`); endpoint missing |
| Time slots | `BookAppointmentScreen` | — | 🎨 | `doctor_availability` table exists; slot generation missing |
| Book appointment | `BookAppointmentScreen` | — | 🎨 | No `Appointment` model — booking is decorative |
| Payment | `PaymentScreen` | — | 🎨 | No payment model/gateway — decorative |

## Wellness & Relief Sessions

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Session player (yoga/meditation/breathing) | `YogaSessionScreen` | — | 🎨 | Full player UI; content from local mock |
| Relief session player (acupressure) | `ReliefSessionScreen` | — | 🎨 | Full player UI; content from local mock |
| Session catalog API | services ready | — | ❌ | Needs `GET /api/v1/sessions`, `/relief-sessions` |
| Save completed session | called on completion | — | ❌ | `POST /api/v1/therapy-history/save` missing — data silently lost |
| Therapy history | `TherapyHistoryScreen` | — | 🎨 | Shows mock data |

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
| Consult | 10 | 1 | detail, filters, visit types, slots, booking, payment |
| Sessions/Relief | 4 | 0 | catalogs |
| Therapy | 2 | 0 | history, save |
| Face Glow | 4 | 0 | routines, scan, history |
| **Total** | **31** | **8** | **23** |

---

## Priority Queue (backend work)

### P0 — Blocks core UX
1. `GET /api/v1/doctors/:id` — doctor detail screen
2. `GET /api/v1/doctors/:id/time-slots` + slot generation from `doctor_availability`
3. `POST /api/v1/appointments/book` (+ `Appointment` model + migration)
4. `POST /api/v1/therapy-history/save` + `GET /api/v1/therapy-history` (+ model)

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
| Frontend tests thin | Medium | jest suite now runs (was broken); 2 suites / 6 tests (App render + secureStorage) — screens/services untested |
| Monolithic screens | Low | Styles duplicated; no shared theme |
| `BottomNav.js` unused | Low | React Navigation tabs used instead — candidate for deletion |
| Backend test coverage | Info | 25 tests cover all existing endpoints + rate limiting; extend with each new feature |
| HomeScreen renders empty text labels | Low | PR #1 emptied `<Text>` contents; `STRINGS` constants exist in `src/constants/strings.js` but aren't wired in (UI change — deliberately out of scope of the infra migration) |
| `DoctorProfileScreen` eslint errors | Low | 2 pre-existing `react-hooks/exhaustive-deps` errors (missing `doctor.id` dependency) |
