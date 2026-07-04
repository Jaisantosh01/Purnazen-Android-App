# SRS Audit — Purnazen

**Audited against:** `SRS_MHeal.pdf` (Calypsion Innovations) — *AI Assisted Acupressure & Wellness App*
**Date:** 2026-07-03 (originally 2026-06-15; refreshed for the native admin/doctor apps, therapy feedback, and address management)
**Scope of this repo:** Three React Native apps — **patient** (`mobile-users`),
**admin** (`mobile-admin`), and **doctor** (`mobile-doctors`) — plus the shared
FastAPI backend. The original SRS assumed *web* admin/super-admin consoles; those
are not built, but the native admin & doctor apps now cover most of that scope.

| Status | Meaning |
|--------|---------|
| Done | Implemented end-to-end |
| Partial | Usable but a sub-requirement is stubbed/pending |
| UI only | UI exists, no backing service |
| No | Not started / out of current scope |

> Companion docs: build/stub/gap matrix in **[FEATURES.md](FEATURES.md)**; open backlog in **[TASKS.md](TASKS.md)**.

---

## 1–3. Naming, Overview & Roles

| SRS item | Status | Notes |
|----------|--------|-------|
| App name **Purnazen** / tagline *AI Assisted Acupressure & Wellness App* | Done | Renamed 2026-06-16 (was "M-Heal"); package ids `com.purnazen[.doctor/.admin]` since 2026-06-19; lotus icon. |
| User mobile application | Done | `mobile-users/`. |
| Backend system with AI-assisted logic | Done | `backend/` FastAPI + OpenCV/MediaPipe scan pipeline + DB-driven chat assistant. |
| Admin dashboard (component) | Partial | Native **`mobile-admin`** app: doctors, users, appointments, slots/leaves, metadata, roles, videos + KPI dashboards. The SRS assumed a *web* console — not built. |
| Role: **User** | Done | Full auth + app flow. |
| Role: **Admin** (corporate/HR) | Done | Role enforced server-side; native management app shipped. |
| Role: **Super Admin** | No | No separate super-admin console or role split. |

## 4.1 Pain Relief Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Symptom selection | Done | `SelectSymptomScreen` → relief session; plus the **chat assistant** decision-tree (`/chat/flow`) that recommends a video group. |
| MVP symptom set (Neck, Shoulder, Back, Knee, Ankle, Headache, Migraine, Sciatica, Stress) | Partial | **5 of 9 seeded**: Neck Pain, Shoulder Pain, Back Pain, Headache, Stress. **Missing: Knee Pain, Ankle Pain, Migraine, Sciatica** (TASKS G1). |
| Basic questions (optional AI flow) | Done | Chat assistant asks DB-driven questions and captures a 1-10 pain-before rating (2026-07-03). |
| Recommend therapy → watch video → timer execution → feedback | Done | Relief player + video-group player; completion saved; pain-after + feedback collected. |
| Therapy structure: video, step-by-step, duration/step, repetition, precautions | Partial | Steps/duration/video present; **verify repetition count + precautions fields** populated per session. |

## 4.2 Video Instruction Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Video playback | Done | Session players + modern `VideoPlayer` (scrubber, fullscreen) for admin-uploaded video groups. |
| Multiple steps per therapy | Done | Step list with per-step timing; video groups with ordered catalog. |
| Optional voice instruction | No | Not implemented (SRS optional). |
| Timer integration | Done | Per-step countdown. |

## 4.3 Face Glow Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Face scan (basic camera capture) | Done | Exceeds spec — Vision Camera + real OpenCV/MediaPipe pipeline. |
| Recommended routines (manual mapping to train model) | Done | DB-backed routines + rule-based recommendation engine. |
| Video-based facial therapy | Partial | Routines listed with video, but the routine "play" is still a stub (TASKS E1). |

## 4.4 Health Tracking Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Pain level input (1–10) | Done | Pain-before captured in the chat assistant, pain-after in the video player (`therapy_feedback`, 2026-07-03). |
| Therapy history | Done | `TherapyHistoryScreen` + `GET /therapy-history` + per-group completed counts. |
| Feedback (helped / not helped) | Done | Free-text + pain delta; doctor/admin feedback slots exist server-side (review screens pending — TASKS F3). |

## 4.5 Appointment Booking Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Clinic appointment booking | Done | Fixed 2026-07-03 (visit-type handling). |
| Home visit request | Done | Requires a saved address from the new address book (`/user-addresses`). |
| Time slot selection | Done | Availability minus booked; respects doctor leaves + slot timings. |
| Appointment confirmation | Done | `BookingConfirmedScreen` with booking ref; history + detail screens. |

## 4.6 Payment Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Consultation payment | Partial | Order → HMAC verify flow in **local sandbox**; Razorpay native checkout pending real keys (TASKS A1). |
| Subscription payment | UI only | Plans shown; no billing (TASKS A2). |
| Payment status tracking | Done | Appointment marked paid on verify. |

## 4.7 Subscription Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Free / Premium / Personal / Corporate plans | UI only | Static plan list; no purchase/enforcement. |
| Free 2-min therapy access gating | No | Not enforced (TASKS A3). |

## 4.8 Admin Dashboard / 4.9 Super Admin Panel

| SRS item | Status | Notes |
|----------|--------|-------|
| Upload videos | Done | Admin app uploads to Azure Blob; video + group CRUD. |
| Manage appointments | Done | `AppointmentManagementScreen` + `GET /appointments/admin`. |
| Accept/reject home visits | Partial | Appointment status updates exist; no dedicated approve/reject workflow. |
| View patient data | Done | User management screens (`GET /users`, `/users/:id`). |
| Track feedback | Partial | Admin-feedback endpoint exists; no review screen yet (TASKS F3). |
| Super Admin: full control, user/content mgmt, analytics | Partial | Role/metadata/slot/leave management shipped in the admin app; analytics events + web console not built (TASKS D6, G3). |

## 5. Non-Functional Requirements

| SRS item | Status | Notes |
|----------|--------|-------|
| Load < 3s | Partial | Splash + bootstrap; not formally measured. |
| 1,000+ concurrent users | Partial | FastAPI + Postgres + Redis cache; not load-tested (TASKS D7). |
| Secure data + payments | Done | Keychain tokens, HMAC payment verify, no card data stored; OTA via short-lived SAS. |
| Simple UI | Done | Dark mode across all screens; themed alerts. |
| Android (initial) | Done | Android-first; three co-installable apps. |

## 6. Data Requirements

| Entity | Status | Notes |
|--------|--------|-------|
| Users | Done | `users` (+ OAuth fields, phone/gender/DOB) + `user_addresses`. |
| Symptoms | Partial | Represented via relief-session keys + chat flow; no dedicated `symptoms` table. |
| Therapy Videos | Done | `videos`/`video_groups` (blob-hosted) + session/routine `video_url`s. |
| Appointments | Done | `appointments` + `consultation_records` (clinical notes). |
| Payments | Done | Order/verify records. |
| Feedback | Done | `therapy_feedback` (pain before/after, user/doctor/admin feedback) + scan results. |

## 7. Constraints / 8. Future / 9. Assumptions

- Video-only, Android-first, limited symptom set — honoured.
- "No advanced AI/ML in initial release" — repo goes beyond the SRS with the
  CV face-scan pipeline (kept optional/degrading so it never blocks core UX).
- Future (3D, AR, AYUSH, e-commerce) — not started, as expected.

## 10. Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| All modules functional and tested | Partial — patient modules Done/Partial; admin/doctor apps functional; formal test matrix pending |
| User completes full therapy flow | Done (incl. pain before/after feedback) |
| Booking + payment workflows | Partial (payment sandbox) |
| Admin manages content/appointments | Done for videos/appointments/doctors/users; session-content + support CMS screens pending (TASKS F1/F2) |

## 11. Privacy Policy

| SRS item | Status | Notes |
|----------|--------|-------|
| Consent-based collection | Done | `user_consents` + consent-gated scan upload. |
| Data deletion / user rights | Done | Account delete (cascade) + scan delete; GDPR bulk scan delete pending (TASKS D1). |
| Secure cloud storage + encryption | Partial | Blob/Cloudinary storage; encryption-at-rest is provider-dependent. |
| Disclaimer (not medical advice) | Partial | **Surface in-app** (Settings/onboarding) — TASKS G2. |

## 12. Security Policy

| SRS item | Status | Notes |
|----------|--------|-------|
| Encryption in transit / at rest | Partial | TLS in prod; at-rest provider-dependent. |
| Secure auth (OTP/password) | Partial | Password + JWT refresh done; **OTP not implemented** (TASKS C3). |
| Role-based access control | Done | user/doctor/admin enforced server-side; `expected_role` login gates per app. |
| Payment via 3rd-party gateway, no card storage | Done | Razorpay; no sensitive financial data stored. |
| Monitoring / backups / IT-Act compliance | Partial | Sentry/monitoring pending (TASKS D5); operational concerns not codified. |

---

## Top gaps vs SRS (recommended next)

1. **Subscription billing + plan gating** (incl. the free 2-min limit) — TASKS A2/A3.
2. **Razorpay native checkout** with real test keys — TASKS A1.
3. **Push delivery (FCM)** — TASKS B1.
4. **OTP authentication** — TASKS C3.
5. **In-app medical disclaimer** — TASKS G2.
6. **Seed the 4 missing MVP symptoms** + verify repetition/precautions fields — TASKS G1.
7. **Feedback review screens** for doctor/admin (endpoints exist) — TASKS F3.
