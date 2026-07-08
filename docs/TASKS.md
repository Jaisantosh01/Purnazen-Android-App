# Task Backlog

**Last updated:** 2026-07-03. Build/stub/gap status per feature:
[FEATURES.md](FEATURES.md). Completed-work detail: [CHANGELOG.md](CHANGELOG.md).

Conventions for backend tasks: model → import in `db/base.py` →
`alembic revision --autogenerate` → schema → repository → service → endpoint →
`router.py` → tests (see [ARCHITECTURE.md](ARCHITECTURE.md)).

---

## Open backlog

### A. Payments & monetization

- **A1. Razorpay native checkout with real keys** (carried from T11) — the
  backend order → HMAC verify flow works in local sandbox mode
  (`sandboxPaymentId`/`sandboxSignature`); wire `react-native-razorpay` checkout
  once real test keys exist. Card/UPI inputs on `PaymentScreen` are placeholders.
- **A2. Subscriptions backend + billing (T14)** — plans model + endpoints;
  replace the hardcoded `PLANS` in `SubscriptionsScreen`; billing provider
  decision pending.
- **A3. Plan gating (T48 + SRS 4.7)** — gate comparison/extended trends and the
  free 2-minute therapy limit behind plan level; "Upgrade" stub screen.

### B. Notifications

- **B1. Push delivery (FCM)** — preferences already persist
  (`/users/me/preferences`); nothing is delivered. Blocks B2.
- **B2. Scan notifications (T37, deferred)** — `scan_notifications` table +
  records; revisit with B1.

### C. Auth

- **C1. Social auth backend (T40)** — DONE via Firebase Auth: the backend
  verifies Firebase ID tokens (`social_auth.py`, `POST /auth/social`), so any
  provider enabled in the Firebase console (Google, GitHub, ...) works with the
  single `FIREBASE_SERVICE_ACCOUNT_JSON` credential. Apple deferred (no iOS).
- **C2. Social auth mobile (T41 remainder)** — DONE via Firebase Auth's
  built-in browser flow (`socialAuthService.js` in all three apps); no
  per-provider SDKs or client IDs needed, only `google-services.json`.
- **C3. OTP authentication** — SRS lists OTP/password; not implemented.

### D. Face analysis — remaining sprint work (spec: [FACE_ANALYSIS_SPEC.md](FACE_ANALYSIS_SPEC.md))

- **D1. Security hardening (T42)** — wire the `5/minute` scan-upload rate limit
  (already in config); Cloudinary signed-URL delivery; `POST /face-glow/data`
  GDPR bulk delete; server-side JPEG recompression before upload.
- **D2. Analyzer test matrix (T43)** — pytest for all 9 analyzers with fixture
  images across lighting/skin tones/angles; API integration tests for scan
  endpoints.
- **D3. Mobile polish (T44)** — upload progress bar, `GlowScoreGauge` animated
  arc, share button (`react-native-view-shot`), `ScanHistorySkeleton`.
- **D4. Celery queue (T45)** — replace `BackgroundTasks` with
  `process_scan.delay()`; worker Dockerfile; broker/result config.
- **D5. Monitoring (T46)** — `sentry-sdk[fastapi]`, structured JSON step-timing
  logs, `GET /health/detailed` (DB/Redis/Cloudinary), Flower.
- **D6. Analytics events (T47)** — `analytics_events` table; emit
  scan_started/completed/failed, recommendation_clicked; admin aggregate endpoint.
- **D7. Final QA (T49)** — load test 100 concurrent uploads (P95), end-to-end on
  physical device (minSdk 24), UX pass over empty/error/skeleton states.

### E. Patient-app polish (carried from the retired USER_APP_AUDIT tracker)

- **E1. FaceGlow routine player** — routine "play" is still
  `showAlert(routine.title, 'Starting routine!')`; build the guided routine
  player (video + steps).
- **E2. Download My Data** — Settings row shows a "will be emailed" alert; needs
  an export pipeline.
- **E3. Remaining "coming soon" rows** — a few Help & Support links and Settings
  rows still alert-stub.
- **E4. Responsiveness sweep** — audit fixed dp widths, `numberOfLines`, and
  `Dimensions.get` snapshots across small (≤360dp) → tablet widths.
- **E5. Location permission wiring** — `locationAccess` toggle is local-only;
  wire OS runtime permission + persist/enforce.

### F. Staff apps — wire existing endpoints

- **F1. Admin content CRUD screens** — quick-relief cards and wellness/relief
  session content have full CRUD endpoints but no admin UI.
- **F2. Admin support CMS screens** — `/support/contacts` + `/support/faqs`
  CRUD endpoints have no admin UI.
- **F3. Therapy-feedback review** — doctor (`/doctor-feedback`) and admin
  (`/admin-feedback`) endpoints exist; no screens in either staff app.

### G. SRS compliance leftovers (see [SRS_AUDIT.md](SRS_AUDIT.md))

- **G1. Seed the 4 missing MVP symptoms** — Knee Pain, Ankle Pain, Migraine,
  Sciatica in `seed_data.py`; confirm repetition/precautions fields populated.
- **G2. In-app medical disclaimer** — surface "not medical advice" in
  Settings/onboarding.
- **G3. Web super-admin console** — SRS assumed web consoles; the native admin
  app covers most scope, a web console remains unbuilt (decision needed on
  whether it is still in scope).

---

## Completed (chronological summary)

Full detail for every item is in [CHANGELOG.md](CHANGELOG.md).

| When | What |
|------|------|
| 2026-06-12 | **P0 T1-T5** booking funnel (doctor detail, visit types, time slots, booking, therapy history) · **P1 T6-T11** (filters, session catalogs, profile mgmt, register screen, 401 auto-refresh, sandbox payments) · **P2** T12/T15/T18/T19 (home rows, preferences, STRINGS, CI) · tech-debt burn-down (keychain tokens, rate limiting, CORS, env config) |
| 2026-06-13 | T16 theme tokens + T17 frontend test coverage; RN 0.85 + Expo SDK 56; folder restructure |
| 2026-06-14/15 | **Face Analysis Sprints 1-3** (T20-T35): consent API, routines DB, upload pipeline, Vision Camera screens, real MediaPipe/OpenCV pipeline with 9 analyzers + TCM recommendation engine, error reporting |
| 2026-06-16 | **Sprint 4** (T36/T38/T39): real tongue analysis, dashboard/trends/compare + screens; **Cycles 1-5**: CV calibration, processing UX, separate tongue scan, quality-preview endpoint, rebrand to **Purnazen**; Consent UI slice of T41 |
| 2026-06-17 | Repo restructure: `mobile-users` + `mobile-doctors` skeleton |
| 2026-06-19 | Package rename to `com.purnazen[.admin]`, lotus icon, dark mode (`useTheme`), biometric login |
| 2026-06-22/24 | Azure Container Apps deployment verified end-to-end; prod CI/CD (OIDC) on the Calypsion repo |
| 2026-06-26 | Admin & doctor app Profile/Settings parity; doctor Dashboard/Patients/clinical records (`consultation_records`); OTA updates from private Azure Blob (`app_releases`); DB-backed Help & Support; face-scan UUID migration fix; pre-prod validation pass (API URL verbatim, prod OTA repo) |
| 2026-07-03 | **PR #22**: therapy feedback (pain before/after + tri-party feedback), user address book + home-visit address requirement, home/clinic booking fixes, chat assistant → video-group flow, video-group player |

Superseded/dropped task IDs: T13 (Face Glow backend — shipped with Sprint 1),
T16 dark-mode remainder (all 33 user-app screens migrated), T37 (→ B2),
T40/T41 social slice (→ C1/C2), T42-T49 (→ D1-D7), T14 (→ A2).

---

## Implementation notes worth keeping

- **P0 (2026-06-12):** visit-type slugs `video`/`home`/`clinic` map to
  `consultation_types` lookup names in `doctor_service.py`
  (`VISIT_TYPE_PRESENTATION`); booking conflict check is app-level (no partial
  unique index); therapy stats count completed sessions only,
  `avgRelief = round(avg(painAfter − painBefore))`.
- **P1 (2026-06-12):** filter routes register before `/doctors/{id}`
  (path-converter ordering); frontend mock data files stay as offline/instant
  fallbacks — API wins once fetched; token revocation = `users.token_version` ↔
  JWT `ver` claim; payments run keyless in local sandbox mode (verify path
  identical to live).
- **Scan pipeline:** BackgroundTask creates its own `SessionLocal()` (request
  session is closed by then); graceful-degradation ladder MediaPipe → Haar →
  centred crop → friendly retake message; mediapipe/opencv/skimage wheels are
  Python ≤3.12 — server boots without them and falls back to OpenCV-only.

## Environment / tooling notes

- **RN 0.85.3 + Expo SDK 56**; Node 22.13+ LTS preferred (23.x works, outside
  supported engines). JDK 17+, Android SDK 35/36.
- Metro ports: users 8081, doctors 8082, admin 8083 (baked into
  `gradle.properties` + npm scripts) — all three apps co-installable
  (`com.purnazen`, `.doctor`, `.admin`).
- **API URL:** `EXPO_PUBLIC_API_URL` in each app's `.env` (inlined at bundle
  time). Used verbatim since 2026-06-26 — no localhost → 10.0.2.2 rewrite; use
  `adb reverse tcp:5000 tcp:5000`. See [RUNNING.md](RUNNING.md).
- **Windows native builds:** enable long paths (see root README); admin-app
  ninja fix documented in the repo memory / local.properties.
- **Local signed APKs:** `scripts/build-apks.sh` (Docker). Cloud:
  [DEPLOYMENT.md](DEPLOYMENT.md) / [AZURE_RUNBOOK.md](AZURE_RUNBOOK.md).
