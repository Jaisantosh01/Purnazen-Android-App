# Task Backlog — Gap Features

**Last updated:** 2026-06-12 (P0 T1–T5, P1 T6–T11 **and P2 T12/T15/T18/T19 completed** — see CHANGELOG; T13/T14/T16/T17 remain). Derived from the FEATURES.md scoreboard plus frontend work. Ordered by priority; each task lists scope, touched layers, and acceptance criteria. Conventions for backend tasks: model → import in `db/base.py` → `alembic revision --autogenerate` → schema → repository → service → endpoint → `router.py` → tests (see ARCHITECTURE.md).

P0 implementation notes (2026-06-12): visit-type slugs `video`/`home`/`clinic` map to the `consultation_types` lookup names in `app/services/doctor_service.py` (`VISIT_TYPE_PRESENTATION`); booking conflict check is app-level (no partial unique index); seed adds Mon–Sat 09–12 & 14–17 availability (30-min slots) per doctor; therapy stats = completed sessions only, `avgRelief = round(avg(painAfter − painBefore))`.

P1 implementation notes (2026-06-12): filter routes are registered before `/doctors/{id}` (path-converter ordering); T7 keeps the frontend mock data files as offline/instant-render fallbacks (screens init timer state synchronously) — API content wins once fetched; T8 token revocation = `users.token_version` ↔ JWT `ver` claim (also kills deleted users' tokens); T10 resets to Login through `src/navigation/navigationRef.js`; T11 runs keyless in a **local sandbox mode** (backend returns `sandboxPaymentId`/`sandboxSignature`; verify path identical to live) — the react-native-razorpay checkout for real keys is still open (native module, needs an Android SDK machine).

---

## P0 — Blocks core UX (the booking funnel) — ✅ ALL DONE 2026-06-12

### ✅ T1. Doctor detail endpoint
- **Backend:** `GET /api/v1/doctors/:id` returning the same card shape as the list endpoint (single object, 404 envelope when missing). No new model — `DoctorRepository.get_by_id` + service + endpoint.
- **Frontend:** `consultService.getDoctorDetail(id)` already calls `ENDPOINTS.DOCTOR_DETAIL(id)` with a mock fallback — verify shape matches, then remove fallback.
- **Accept:** DoctorProfileScreen renders live data; tests for 200 + 404.

### ✅ T2. Visit types endpoint
- **Backend:** `GET /api/v1/doctors/:id/visit-types` from the existing `consultation_types` m2m (id, name, fee/duration if modeled; else derive fee from `doctors.consultation_fee`).
- **Frontend:** BookAppointmentScreen already fetches via `consultService.getVisitTypes(doctor.id)` and falls back to `DEFAULT_VISIT_TYPES`.
- **Accept:** Visit-type chips reflect DB rows; test covers doctor with/without types.

### ✅ T3. Time slots + slot generation
- **Backend:** `GET /api/v1/doctors/:id/time-slots?date=YYYY-MM-DD`. Generate slots from `doctor_availability` (day-of-week, start/end, slot_duration), minus already-booked appointments (depends on T4 model; until then return all generated slots). Validate date ≥ today.
- **Frontend:** already wired with fallback (`consultService.getTimeSlots`).
- **Accept:** Slots match seeded availability; booked slots excluded once T4 lands; tests for empty day, invalid date.

### ✅ T4. Appointment booking
- **Backend:** new `Appointment` model (user FK, doctor FK, consultation_type FK, date, slot start/end, status: booked/cancelled/completed, created_at) + migration. `POST /api/v1/appointments/book` (auth required) with conflict check (unique doctor+date+slot among non-cancelled), `GET /api/v1/appointments` (user's upcoming/past). Seed statuses.
- **Frontend:** BookAppointmentScreen → BookingConfirmedScreen currently navigates without calling anything; wire `consultService.bookAppointment(payload)`; pass booking ref to the confirmation screen.
- **Accept:** Double-booking a slot returns 409-style envelope; booking appears in `GET /appointments`; tests for happy path, conflict, unauthenticated.

### ✅ T5. Therapy history (save + list)
- **Backend:** new `TherapySession` model (user FK, session_key, session_type yoga/meditation/breathing/acupressure, duration_seconds, completed_at) + migration. `POST /api/v1/therapy-history/save` (auth), `GET /api/v1/therapy-history` (auth, newest first, paginated).
- **Frontend:** YogaSessionScreen/ReliefSessionScreen already call `therapyService.saveSession(...)` on completion (currently silently lost); TherapyHistoryScreen shows mock — wire list.
- **Accept:** Completing a session persists it and it appears in TherapyHistoryScreen; tests for save + list + auth-required.

## P1 — Feature completeness — ✅ ALL DONE 2026-06-12

### ✅ T6. Doctor filter endpoints
- **Backend:** `GET /doctors/available-today`, `/video-call`, `/home-visit`, `/top-rated` (or one endpoint with `?filter=`). available-today uses `is_available_today`; video/home filter by consultation_type name; top-rated by `average_rating >= 4.5` ordered desc.
- **Frontend:** ConsultScreen filter tabs currently filter client-side mock; wire to endpoints.
- **Accept:** Each tab shows distinct server-filtered list; tests per filter.

### ✅ T7. Session catalogs (wellness + relief)
- **Backend:** models `WellnessSession` and `ReliefSession` mirroring `src/data/yogaSessionData.js` / `reliefSessionData.js` shapes (key, title, type, duration, steps JSON, media URLs). Seed from those files. `GET /api/v1/sessions`, `GET /api/v1/sessions/:key`, `GET /api/v1/relief-sessions`, `GET /api/v1/relief-sessions/:key`.
- **Frontend:** wellnessService/reliefService already call these with mock fallbacks.
- **Accept:** Players run from API content with mocks deleted; tests for list + detail + unknown key.

### ✅ T8. Profile management endpoints
- **Backend:** `PUT /api/v1/auth/me` (full_name, avatar_url), `POST /api/v1/auth/change-password` (current + new, bcrypt verify, revoke refresh tokens on change), `DELETE /api/v1/auth/me` (soft-delete or hard-delete + cascade; revoke tokens).
- **Frontend:** SettingsScreen UI exists; wire forms + logout-on-delete.
- **Accept:** Tests: wrong current password 401, password change invalidates old refresh token, deleted user can't login.

### ✅ T9. Registration screen (frontend)
- **Frontend only:** `RegisterScreen` (full_name, email, password + confirm), calls existing `POST /auth/register`, then auto-login. Add to RootStack + link from LoginScreen.
- **Accept:** New account can register → land on Main tabs; jest test for the screen.

### ✅ T10. Axios auto-refresh on 401
- **Frontend only:** response interceptor in `src/api/client.js`: on 401 (not from `/auth/login|/auth/refresh`), call `ENDPOINTS.REFRESH` with the keychain refresh token, store the new access token (`secureStorage`), replay the original request; queue concurrent 401s behind one refresh; on refresh failure clear tokens + reset to Login.
- **Accept:** Unit test with mocked axios adapter: expired access token → one refresh call → original request succeeds; refresh failure → logout.

### ✅ T11. Payment processing (Razorpay sandbox) — *checkout SDK for real keys still open*
- **Backend:** `Payment` model (appointment FK, amount, currency, provider ref, status) + `POST /api/v1/payments/process` (sandbox order create) + webhook/verify endpoint.
- **Frontend:** PaymentScreen wired to order → Razorpay checkout (react-native-razorpay) → verify.
- **Accept:** Sandbox payment marks appointment paid; failure path leaves it unpaid; tests with provider mocked.

## P2 — Polish / platform — partially done 2026-06-12 (T12, T15, T18, T19 ✅)

### ✅ T12. Wellness rows on Home from API — done by reusing the T7 `GET /sessions` list; HomeScreen maps catalog keys to MCI icon names (`WELLNESS_ROW_ICONS`), shows the first 3 rows ("See All" → Wellness tab), keeps the local fallback offline.
### T13. Face Glow backend (routines model + `GET /face-glow/routines`, `/routines/:key`; scan + history later — needs media upload + storage decision).
### T14. Subscriptions (plans model + endpoints; billing provider decision pending).
### ✅ T15. Notification preferences persistence — `user_preferences` table (migration `e6f3a82d4c91`): `push_enabled` master + JSON dict of toggle ids (no migration per new toggle). `GET`/`PUT /api/v1/users/me/preferences` (auth, partial merge). SettingsScreen + NotificationsScreen toggles hydrate from the server and save optimistically (`preferencesService`). Push *delivery* (FCM/`expo-notifications`) still open.
### T16. Shared theme adoption — migrate the 20 screens' StyleSheets to `src/constants/theme.js` tokens (COLORS/SPACING/RADIUS); delete per-screen duplicates. Mechanical, do screen-by-screen.
### T17. Frontend test coverage — services (axios mocked), authService (keychain mock exists), 2–3 screen smoke tests. Target: every service file has a suite.
### ✅ T18. Wire `STRINGS` constants into HomeScreen empty `<Text>` labels (pre-existing PR #1 regression noted in FEATURES.md) — all 10 labels restored.
### ✅ T19. CI: `.github/workflows/ci.yml` — backend pytest (Python 3.13) + frontend jest/tsc/eslint (Node 22) on PRs and pushes to main.

---

## Environment / tooling notes (2026-06-12)

- **RN 0.85.3 + Expo SDK 56** now installed (RN 0.84 had no matching Expo SDK — Expo skipped it).
- **Android builds on a new machine need:** Android Studio (or cmdline-tools) with SDK 36, `ANDROID_HOME` set, JDK 17+ (21 present). This machine currently has **no Android SDK** — install before `npx react-native run-android`. First gradle run should also execute `gradlew wrapper --gradle-version 9.3.1` to refresh wrapper scripts/jar (distributionUrl already bumped; old wrapper jar works but is from 9.0).
- **Node:** v23.8 works but is outside RN 0.85's supported engines — prefer Node 22.13+ LTS or 24.3+.
- **API URL config:** `wellness-frontend/.env` → `EXPO_PUBLIC_API_URL` (inlined at bundle time; defaults to `http://10.0.2.2:5000`).
