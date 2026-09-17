# Features Tracker

**Last updated:** 2026-09-16. Completion estimates, per-platform status and the phased
plan are in **[STATUS.md](STATUS.md)**; distribution in **[DISTRIBUTION.md](DISTRIBUTION.md)**.

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
| Patient | `mobile-users` | `com.purnazen` | `patient` | Full feature set (39 screens). Android release-ready in code; iOS runs in the Simulator |
| Doctor | `mobile-doctors` | `com.purnazen.doctor` | `doctor` | Functional (29 screens): dashboard, appointments, schedule, leave, patients, clinical records, scan reports. iOS not yet built |
| Admin | `mobile-admin` | `com.purnazen.admin` | `admin` | Functional (29 screens): doctors, users, appointments, slots/leaves, metadata, videos, content, FAQs, notifications, GST, roles. iOS not yet built |

All three share the same stack (RN 0.85 / Expo SDK 56) and client patterns:
dark mode (`useTheme` + persisted `themeStore`), biometric login, themed alerts,
JWT keychain storage with silent 401 refresh, and a store-update banner.

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
| Social auth: Google | `socialAuthService` | `POST /auth/social` | Done | Firebase Auth; backend verifies the Firebase ID token and issues its own JWTs |
| Social auth: Apple | — | (same endpoint) | Planned | Required for App Review guideline 4.8 once Google sign-in ships on iOS — STATUS.md Phase 1 |
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
| Video group player | `VideoPlayerScreen` | `GET /videos/groups/:id/catalog` | Done | Scrubber with buffered range, double-tap ±10s, fullscreen with title, up-next |
| Player quality & speed | `VideoPlayer` gear menu | catalog `renditions` | Done | Speed 0.75–2×. Quality: HLS ladder on Android (`onVideoTracks`), bitrate caps on iOS; MP4 masters get siblings named `<stem>.<height>p.mp4` (e.g. `yoga/warmup.720p.mp4`) listed as renditions — Auto steps down after repeated stalls |
| Health report PDF | `HealthReportScreen` → Export PDF | `POST /users/me/health-report/export` → `GET /users/me/health-report.pdf?t=` | Done | reportlab render on request; 10-min link token so the system browser can open/save it. Report now carries recent runs + day streak |
| Save completed session | on completion | `POST /therapy-history/save` | Done | |
| Therapy history + stats | `TherapyHistoryScreen` | `GET /therapy-history`, `/completed-count/:groupId` | Done | Sessions/minutes/avgRelief; per-group completion count |
| Therapy feedback (pain before/after) | `ChatAssistantScreen`, `VideoPlayerScreen` | `POST /therapy-feedback`, `PUT .../pain-after` | Done | 1-10 pain scale before (chat) and after (player) + free-text feedback; doctor/admin feedback fields exist server-side |

## Face & tongue analysis

Real classical-CV pipeline: MediaPipe FaceLandmarker + 9 OpenCV/skimage
analyzers producing glow/dullness/skin-age scores + wellness recommendations, with a
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
| Notification preferences | `NotificationsScreen`, Settings | `GET/PUT /users/me/preferences` | Done | |
| Help & Support | `HelpSupportScreen` | `GET /support/help` | Done | DB-backed contacts + FAQs (2026-06-26); some rows still "coming soon" |
| Subscriptions | `SubscriptionsScreen` | `GET /subscriptions/plans`, `POST /subscriptions/subscribe` | Partial | Plans are served at ₹0; priced plans are refused (402) until Play Billing / StoreKit verification exists — STATUS.md Phase 4 |
| Update banner | `updateService`, `UpdateBanner` | `GET /app-releases/latest` | Done | Version check only; tapping deep-links to the store listing. The app never downloads or installs a build itself — Play's Device and Network Abuse policy forbids it. |
| Error reporting | `ErrorBoundary` + service | `POST /errors/report` | Done | |
| Download my data | Settings row | — | UI only | Alert stub; no export pipeline |
| Push notifications (FCM) | `pushService` + `NotificationCenterScreen` | `/notifications/device-tokens`, `fcm_service` | Done | Android. iOS needs an APNs key uploaded to Firebase |

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
| Leave requests | `ApplyLeaveScreen`, `LeaveHistoryScreen`, `LeaveDetailScreen` | `/doctor-leaves` | Done | |
| Patient scan reports | `FaceScanHistory/Report`, `TongueScanHistory/Report` | `/patients/...` | Done | Doctor sees the patient's face and tongue scan results |
| Push notifications | `pushService`, `NotificationCenterScreen` | `/notifications` | Done | |
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
| Content management | `ContentManagementScreen`, `ContentEditorScreen` | `/sessions`, `/content-pages` | Partial | Session content and legal pages (terms/privacy) done; quick-relief cards have no admin UI |
| Support CMS | `FaqManagementScreen` | `/support/faqs`, `/support/contacts` | Partial | FAQs done; support contacts have no admin UI |
| Broadcast notifications | `NotificationAdminScreen` | `/notifications` | Done | |
| GST settings | `TaxSettingsScreen` | `GET/PUT /tax/config` | Done | Rate snapshotted on each booking |
| Therapy feedback review | — | `PUT /therapy-feedback/:id/admin-feedback` | UI only | Endpoint exists; no screen |
| Profile & Settings | `ProfileScreen`, `SettingsScreen` | shared | Done | Parity with patient app; live profile trackers |

---

# Backend platform

FastAPI (Python 3.13), SQLAlchemy 2 + Alembic, PostgreSQL (SQLite for local dev),
Redis-backed caching/rate limiting when configured. **195 routes across 33
endpoint modules** (counted from `app/api/v1/endpoints/`, 2026-09-16). Test suite:
227 passed, 7 skipped (Azure-only).

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
| app-releases | 2 | all apps + CI | Published-version registry: latest version, CI register. Metadata only. |
| errors | 1 | all apps | Client crash/error reports |

Infrastructure: Azure Container Apps deploy via OIDC GitHub Actions
(`.github/workflows/deploy-backend.yml`, `scripts/provision-azure-prod.sh`); signed
Android builds from `release-mobile.yml`; local Docker APK builds
(`scripts/build-apks.sh`). Store and private distribution plan:
[DISTRIBUTION.md](DISTRIBUTION.md).

---

# Known gaps (summary)

Phased plan with estimates: **[STATUS.md](STATUS.md)**. Backlog: **[TASKS.md](TASKS.md)**.

1. **iOS** — Patient app runs in the Simulator; Doctor and Admin apps have never been built; no TestFlight builds, no Sign in with Apple, no APNs key.
2. **Store accounts & listings** — Play Console / Apple Developer organisation accounts, listing assets, lawyer-reviewed legal copy.
3. **Monetisation** — no Play Billing / StoreKit; plans are ₹0. Razorpay is sandbox-only for consultations.
4. **Hardening** — Firebase App Check, admin 2FA, Redis in production, Sentry/monitoring, load test, analyzer test matrix.
5. **Data rights** — "Download my data" export is a stub.
6. **Face Glow v2** — muscle-tone display, skin-type label, routine player, milestones, challenges/streaks, check-ins, AI coach, transformation video.
7. **Staff-app gaps** — therapy-feedback review screens; quick-relief and support-contact admin UI.
