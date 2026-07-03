# Features Tracker

**Last updated:** 2026-07-03 (post PR #22 — therapy feedback, user addresses, home/clinic booking fixes; tracker expanded to cover all three apps + backend platform)

Single source of truth for what is built, what is stubbed, and what is missing —
across the three mobile apps and the shared FastAPI backend.

> Open work is tracked in **[TASKS.md](TASKS.md)**. Face-analysis design:
> **[FACE_ANALYSIS_SPEC.md](FACE_ANALYSIS_SPEC.md)** / implementation:
> **[FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md)**. SRS compliance map:
> **[SRS_AUDIT.md](SRS_AUDIT.md)**.

| Status | Meaning |
|--------|---------|
| Done | Implemented and working end-to-end |
| Partial | Usable, but a sub-feature is stubbed or pending |
| UI only | Frontend exists, no backing service (or vice versa) |
| Planned | Not started |

## Apps at a glance

| App | Folder | Package | Role gate | State |
|-----|--------|---------|-----------|-------|
| Patient | `mobile-users` | `com.purnazen` | `user` | Full feature set (35 screens) |
| Doctor | `mobile-doctors` | `com.purnazen.doctor` | `doctor` | Functional (15 screens): dashboard, appointments, schedule, patients, clinical records |
| Admin | `mobile-admin` | `com.purnazen.admin` | `admin` | Functional (18 screens): doctors, users, appointments, slots/leaves, metadata, videos, roles |

All three share the same stack (RN 0.85 / Expo SDK 56) and client patterns:
dark mode (`useTheme` + persisted `themeStore`), biometric login, themed alerts,
JWT keychain storage with silent 401 refresh, and backend-brokered OTA updates.

---

# Patient app (`mobile-users`)

## Authentication & account

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Register | `RegisterScreen` | `POST /auth/register` | Done | Keyboard-aware form, inline password-match indicator, auto-login |
| Profile completion | `ProfileCompletionScreen` | `PUT /auth/me` | Done | Post-signup phone/gender/DOB step; skippable |
| Login | `LoginScreen` | `POST /auth/login` | Done | Tokens + user persisted; Zustand synced |
| Biometric login | `biometricService` | — (device keychain) | Done | Fingerprint/Face ID unlock of restored session; fail-closed to Login |
| Logout | Settings | `POST /auth/logout` | Done | Revokes refresh token server-side |
| Token refresh | axios interceptor | `POST /auth/refresh` | Done | Silent refresh on 401, single-flight queue; jest-tested |
| Edit profile | Settings modals | `PUT /auth/me` | Done | Name/avatar/phone/gender/DOB |
| Change password | Settings modal | `POST /auth/change-password` | Done | Revokes all old tokens (`token_version`) |
| Delete account | Settings | `DELETE /auth/me` | Done | Hard delete + cascade; tokens die immediately |
| Address book | `AddressManagementScreen` (Profile) | `GET/POST/PUT/DELETE /user-addresses` | Done | CRUD + soft delete; used by home-visit booking |
| Social auth (Google/Apple) | — | — | Planned | Deferred — needs OAuth client IDs (TASKS T40/T41) |
| OTP auth | — | — | Planned | Listed in SRS; password + JWT only today |

## Home & chat assistant

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Quick relief cards | `HomeScreen` | `GET /home/quick-relief` | Done | Admin can CRUD cards via `/quick-relief` endpoints |
| Wellness rows | `HomeScreen` | `GET /sessions` | Done | First 3 catalog rows; offline fallback kept |
| Chat assistant | `ChatAssistantScreen` | `GET /chat/flow/start`, `/chat/flow/{id}` | Done | DB-driven decision tree (chat questions/options) that ends in a recommended video group; records pain-before via therapy feedback, then hands off to the video player |

## Consultation & appointments

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Doctor list + search + pagination | `ConsultScreen` | `GET /doctors` | Done | |
| Filter tabs (Today/Video/Home/Top) | `ConsultScreen` | `GET /doctors/available-today` etc. | Done | Server-filtered |
| Doctor detail | `DoctorProfileScreen` | `GET /doctors/:id` | Done | Now includes specialties/expertise/languages metadata |
| Visit types | `BookAppointmentScreen` | `GET /doctors/:id/visit-types` | Done | video / home / clinic |
| Time slots | `BookAppointmentScreen` | `GET /doctors/:id/time-slots?date=` | Done | Availability minus booked; respects doctor leaves |
| Book appointment | `BookAppointmentScreen` | `POST /appointments/book` | Done | Home-visit requires a saved address (PR #22 fixed home/clinic booking); conflict returns 409-style envelope |
| Appointment history + detail | `AppointmentHistoryScreen`, `AppointmentDetailScreen` | `GET /appointments`, `PUT /appointments/:id` | Done | Upcoming/past; cancel/update via PUT |
| Payment | `PaymentScreen` | `POST /payments/process`, `/verify` | Partial | HMAC-verified order-verify flow in local sandbox mode; Razorpay native checkout with real keys still open |

## Therapy: sessions, video groups & feedback

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Session player (yoga/meditation/breathing) | `YogaSessionScreen` | `GET /sessions` | Done | API content wins; local fallback for offline |
| Relief session player (acupressure) | `ReliefSessionScreen` | `GET /relief-sessions/:key` | Done | |
| Video group player | `VideoPlayerScreen` | `GET /videos/groups/:id/catalog` | Done | Modern player (scrubber, fullscreen); plays admin-uploaded video groups |
| Save completed session | on completion | `POST /therapy-history/save` | Done | |
| Therapy history + stats | `TherapyHistoryScreen` | `GET /therapy-history`, `/completed-count/:groupId` | Done | Sessions/minutes/avgRelief; per-group completion count |
| Therapy feedback (pain before/after) | `ChatAssistantScreen`, `VideoPlayerScreen` | `POST /therapy-feedback`, `PUT .../pain-after` | Done | 1-10 pain scale before (chat) and after (player) + free-text feedback; doctor/admin feedback fields exist server-side |

## Face & tongue analysis

Real classical-CV pipeline: MediaPipe FaceLandmarker + 9 OpenCV/skimage
analyzers producing glow/toxin/skin-age scores + TCM recommendations, with a
graceful-degradation ladder. Details: [FACE_ANALYSIS_AI.md](FACE_ANALYSIS_AI.md).

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Face Glow routines | `FaceGlowScreen` | `GET /face-glow/routines` | Partial | DB-backed catalog (Redis cache-aside); the routine "play" button is still a stub alert — no routine player |
| Face scan (9 metrics + glow) | `FaceScanScreen` + processing/results/error screens | `POST /face-glow/scan/upload` + status/history/delete | Done | Consent-gated; live progress stages; mesh overlay; UUID migration fixed 2026-06-26 |
| Tongue scan | `TongueScanScreen` | same endpoints (`scan_type=tongue`) | Done | GrabCut segmentation + Lab/HSV TCM classification |
| Live capture quality | viewfinder hints | `POST /face-glow/quality-preview` | Done | MediaPipe-primary gate rejects empty-wall photos |
| Dashboard / trends / compare | `ScanDashboardScreen`, `ScanComparisonScreen` | `GET /face-glow/dashboard`, `/trends`, `POST .../compare` | Done | SVG charts |
| Scan history | `ScanHistoryScreen` | `GET /face-glow/history` | Done | Paginated, face/tongue filter |
| Privacy & data consent | `ConsentScreen` | `GET/POST/DELETE /consent` | Done | scan_storage / ai_training / gdpr_data; upload 403s without consent |

## Settings & platform

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Dark mode | all 33+ screens via `useTheme` | — | Done | light/dark/system, persisted |
| Notification preferences | `NotificationsScreen`, Settings | `GET/PUT /users/me/preferences` | Done | Push *delivery* (FCM) still open |
| Help & Support | `HelpSupportScreen` | `GET /support/help` | Done | DB-backed contacts + FAQs (2026-06-26); some rows still "coming soon" |
| Subscriptions | `SubscriptionsScreen` | — | UI only | Hardcoded plans; no billing, no plan gating (TASKS T14) |
| In-app updates (OTA) | `updateService` | `GET /app-releases/latest`, `/download` | Done | Backend-brokered private-blob flow; see [OTA_RELEASES.md](OTA_RELEASES.md) |
| Error reporting | `ErrorBoundary` + service | `POST /errors/report` | Done | |
| Download my data | Settings row | — | UI only | Alert stub; no export pipeline |
| Push notifications (FCM) | — | — | Planned | Preferences persist but nothing is delivered |

---

# Doctor app (`mobile-doctors`)

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Login (role-gated) | `LoginScreen` | `POST /auth/login` (`expected_role=doctor`) | Done | Biometric unlock supported |
| Dashboard | `DashboardScreen` | `GET /appointments/doctor` | Done | Today's count, pending requests, active patients, today's schedule, pull-to-refresh |
| Appointments + detail | `AppointmentsScreen`, `AppointmentDetailScreen` | `GET /appointments/doctor`, `PUT /appointments/:id` | Done | Status updates |
| Schedule / availability | `ScheduleScreen`, `AddAvailabilityScreen` | `GET/POST/PUT/DELETE /doctor-availability` | Done | Weekly availability CRUD |
| Patients roster + profile | `PatientsScreen`, `PatientDetail(s)Screen` | derived from appointment feed + `GET /users/:id` | Done | No separate patients table; visit history shown |
| Clinical records (notes/diagnosis/prescription) | `ConsultationNotesScreen` + 3 editors | `GET/POST/PUT/DELETE /appointments/:id/records` | Done | Owner-checked, soft-deleted; persisted since 2026-06-26 |
| Therapy feedback review | — | `PUT /therapy-feedback/:id/doctor-feedback` | UI only | Endpoint exists; no doctor-app screen wired yet |
| Profile & Settings | `ProfileScreen`, `SettingsScreen` | shared endpoints | Done | Parity with patient app: dark mode, biometric, editable profile/phone/password, trackers (today/upcoming/completed) |

---

# Admin app (`mobile-admin`)

| Feature | Frontend | Backend | Status | Notes |
|---------|----------|---------|--------|-------|
| Login (role-gated) | `LoginScreen` | `POST /auth/login` (`expected_role=admin`) | Done | |
| Home dashboard | `HomeScreen` | `GET /admin/stats`, `/admin/doctors/stats` | Done | Doctors/users/appointments-today KPIs |
| Doctor management | `DoctorManagementScreen`, `DoctorDetailScreen`, `EditDoctorScreen` | `GET/POST/PUT /doctors` | Done | Create/edit with specialties, expertise, languages |
| Doctor leave management | `DoctorLeaveManagementScreen` | `GET/POST/PUT/PATCH /doctor-leaves` (+ `/stats`) | Done | Admin-gated; leave KPIs |
| Slot management | `SlotManagementScreen` | `GET/POST/PUT/DELETE /slot-timings` | Done | Grouped by day; soft delete |
| User management | `UserManagementScreen`, `EditUserScreen` | `GET /users`, `GET/PUT /users/:id` | Done | Admin-gated |
| Appointment management | `AppointmentManagementScreen` | `GET /appointments/admin`, `PUT /appointments/:id` | Done | All appointments |
| Metadata management | `MetadataManagementScreen` | specialties / expertises / languages CRUD | Done | Three lookup tables, full CRUD |
| Role management | `ManageRolesScreen` | `GET/POST/PUT/DELETE /roles` | Done | Admin-gated |
| Video management | `VideoManagementScreen`, `UploadVideoScreen`, `VideoGroupDetailScreen` | `/videos` + `/videos/groups` + blob storage endpoints | Done | Upload to Azure Blob, video CRUD, group CRUD + sync videos in group |
| Content management (quick relief / sessions) | — | `POST/PUT/DELETE /quick-relief`, `/sessions` | UI only | Endpoints exist; no admin screens wired yet |
| Support CMS (contacts/FAQs) | — | `POST/PUT/DELETE /support/contacts`, `/support/faqs` | UI only | Endpoints exist; no admin screens wired yet |
| Therapy feedback review | — | `PUT /therapy-feedback/:id/admin-feedback` | UI only | Endpoint exists; no screen |
| Profile & Settings | `ProfileScreen`, `SettingsScreen` | shared | Done | Parity with patient app; live profile trackers |

---

# Backend platform

FastAPI (Python 3.13), SQLAlchemy 2 + Alembic, PostgreSQL (SQLite for local dev),
Redis-backed caching/rate limiting when configured. Approximately **131 routes
across 27 endpoint modules** (counted from `app/api/v1/endpoints/`, 2026-07-03).

| Module | Routes | Consumers | Notes |
|--------|--------|-----------|-------|
| auth | 9 | all apps | JWT access/refresh, `token_version` revocation, role gates |
| doctors | 11 | users, admin | List/filters/detail/visit-types/availability/time-slots + admin create/update |
| doctor-availability | 4 | doctor | Weekly availability CRUD |
| doctor-leaves | 5 | admin | CRUD + KPI stats |
| specialties / expertises / languages | 12 | admin | Lookup-table CRUD |
| appointments | 6 | all apps | Book, update, my-list, doctor feed, admin list, consultation types |
| consultations (clinical records) | 4 | doctor | Owner-checked notes/diagnosis/prescription |
| payments | 2 | users | Sandbox order + HMAC verify |
| sessions / relief / quick-relief | 9 | users, (admin CRUD) | Catalogs + content CRUD |
| therapy-history | 3 | users | Save, list, per-group completed count |
| therapy-feedback | 5 | users, doctor, admin | Pain before/after + tri-party feedback |
| chat | 2 | users | DB-driven decision-tree flow |
| videos | 15 | users, admin | Video/group CRUD, group catalog, Azure Blob upload + directory management |
| face-glow + face-scan | 10 | users | Routines + full scan pipeline (upload/status/history/delete/dashboard/trends/compare/quality-preview) |
| consent | 3 | users | GDPR consent lifecycle |
| users | 5 | all apps | Admin user CRUD + `me/preferences` |
| user-addresses | 4 | users | Address book (soft delete) |
| home | 1 | users | Quick relief cards |
| dashboard (admin) | 2 | admin | Aggregate stats |
| roles | 4 | admin | Role CRUD |
| slot-timings | 4 | admin | Slot template CRUD |
| support | 7 | users, (admin CRUD) | Help content + contacts/FAQs CMS |
| app-releases | 3 | all apps + CI | OTA registry: latest, SAS download, CI register |
| errors | 1 | all apps | Client crash/error reports |

Infrastructure: Azure Container Apps deploy via OIDC GitHub Actions
([DEPLOYMENT.md](DEPLOYMENT.md), [AZURE_RUNBOOK.md](AZURE_RUNBOOK.md)); signed
APKs distributed OTA from a private blob container ([OTA_RELEASES.md](OTA_RELEASES.md));
local Docker APK builds (`scripts/build-apks.sh`).

---

# Known gaps (summary)

Full backlog with owners/priorities: **[TASKS.md](TASKS.md)**.

1. **Payments** — sandbox only; Razorpay native checkout with real keys open.
2. **Subscriptions** — static UI; no billing, no plan gating (incl. SRS free 2-min limit).
3. **Push delivery** — preferences persist, but no FCM; scan notifications deferred with it.
4. **Social auth + OTP** — deferred (needs OAuth credentials / OTP provider).
5. **FaceGlow routine player** — routines listed but "play" is a stub.
6. **Admin screens for existing endpoints** — quick-relief/session content CRUD, support CMS, therapy-feedback review have APIs but no UI.
7. **Face-analysis sprints 6-8** — security hardening (signed URLs, GDPR bulk delete), analyzer test matrix, Celery queue, monitoring, analytics events, premium gating.
8. **SRS leftovers** — 4 missing MVP symptoms in seed, in-app medical disclaimer, load testing.
