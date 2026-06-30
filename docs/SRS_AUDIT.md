# SRS Audit — Purnazen

**Audited against:** `SRS_MHeal.pdf` (Calypsion Innovations) — *AI Assisted Acupressure & Wellness App*
**Date:** 2026-06-15 (admin/doctor app note added 2026-06-26)
**Scope of this repo:** Three React Native apps — **patient** (`mobile-users`),
**admin** (`mobile-admin`), and **doctor** (`mobile-doctors`) — plus the shared
FastAPI backend. The original SRS assumed *web* admin/super-admin consoles; those
are not built, but the admin & doctor management apps below cover much of that
scope natively. Rows referring to "no admin UI" predate these apps.

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented end-to-end |
| ⚠️ | Partial — usable but a sub-requirement is stubbed/pending |
| 🎨 | UI only, no backing service |
| ❌ | Not started / out of current scope |

> Companion docs: build/stub/gap matrix in **[FEATURES.md](FEATURES.md)**; face-analysis sprints in **[FACE_ANALYSIS_SPEC.md](FACE_ANALYSIS_SPEC.md)**.

---

## 1–3. Naming, Overview & Roles

| SRS item | Status | Notes |
|----------|--------|-------|
| App name **Purnazen** / tagline *AI Assisted Acupressure & Wellness App* | ✅ | Renamed to **Purnazen** 2026-06-16 (was "M-Heal"): launcher label (`strings.xml`), `app.json` displayName, Login/Register hero, Home header, new lotus app icon. Android **package id renamed `com.wellness` → `com.purnazen`** on 2026-06-19 (admin app → `com.purnazen.admin`) — namespace, `applicationId`, Kotlin package dirs, `getMainComponentName`, `settings.gradle`, `app.json`/`package.json` all updated. Requires an Android rebuild and reinstall. |
| User mobile application | ✅ | This repo (`mobile-users/`). |
| Backend system with AI-assisted logic | ✅ | `backend/` FastAPI + OpenCV scan pipeline. |
| Admin dashboard (component) | ❌ | Backend role-gate exists (`GET /auth/admin/dashboard`); no admin web UI in this repo. |
| Role: **User** | ✅ | Full auth + app flow. |
| Role: **Admin** (corporate/HR) | ⚠️ | Role enforced server-side; no management UI. |
| Role: **Super Admin** | ❌ | No console. |

## 4.1 Pain Relief Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Symptom selection | ✅ | `SelectSymptomScreen` → relief session. |
| MVP symptom set (Neck, Shoulder, Back, Knee, Ankle, Headache, Migraine, Sciatica, Stress) | ⚠️ | **5 of 9 seeded** (`seed_data.py`): Neck Pain, Shoulder Pain, Back Pain, Headache, Stress. **Missing: Knee Pain, Ankle Pain, Migraine, Sciatica.** Extra non-SRS sessions also seeded (Joint Pain, Eye Strain, Anxiety, Sleep, Better Sleep). |
| Basic questions (optional AI flow) | ❌ | Not built (SRS marks optional). |
| Recommend therapy → watch video → timer execution → feedback | ✅ | `ReliefSessionScreen` player with step timer + completion save. |
| Therapy structure: video, step-by-step, duration/step, repetition, precautions | ⚠️ | Steps/duration/video present; **verify repetition count + precautions fields** are populated per session. |

## 4.2 Video Instruction Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Video playback | ✅ | Session players use `video_url`. |
| Multiple steps per therapy | ✅ | Step list with per-step timing. |
| Optional voice instruction | ❌ | Not implemented (SRS optional). |
| Timer integration | ✅ | Per-step countdown. |

## 4.3 Face Glow Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Face scan (basic camera capture) | ✅ | **Exceeds spec** — Vision Camera capture + real OpenCV analysis pipeline (MediaPipe optional). |
| Recommended routines (manual mapping to train model) | ✅ | DB-backed routines + rule-based recommendation engine on scan results. |
| Video-based facial therapy | ✅ | `FaceGlowScreen` routines with video. |

## 4.4 Health Tracking Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Pain level input (1–10) | ⚠️ | Feedback/relief rating captured on session completion (`avgRelief` stat) — **confirm a 1–10 pain input exists pre-session**. |
| Therapy history | ✅ | `TherapyHistoryScreen` + `GET /therapy-history`. |
| Feedback (helped / not helped) | ✅ | Collected on completion; feeds history stats. |

## 4.5 Appointment Booking Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Clinic appointment booking | ✅ | `BookAppointmentScreen` → `POST /appointments/book`. |
| Home visit request | ✅ | Visit type derived from doctor consultation types. |
| Time slot selection | ✅ | `/doctors/:id/time-slots` (availability minus booked). |
| Appointment confirmation | ✅ | `BookingConfirmedScreen` with booking ref. |

## 4.6 Payment Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Consultation payment | ⚠️ | Full order→verify flow (HMAC-verified) in **local sandbox**; Razorpay native checkout SDK pending real keys. |
| Subscription payment | 🎨 | Plans shown; no billing wired. |
| Payment status tracking | ✅ | Appointment marked paid on verify. |

## 4.7 Subscription Module

| SRS item | Status | Notes |
|----------|--------|-------|
| Free / Premium / Personal / Corporate plans | 🎨 | `SubscriptionsScreen` shows current plan from auth store; static plan list, no purchase/enforcement. |
| Free 2-min therapy access gating | ❌ | Video time-limit gating per plan not enforced. |

## 4.8 Admin Dashboard / 4.9 Super Admin Panel

| SRS item | Status | Notes |
|----------|--------|-------|
| Upload videos, manage appointments, accept/reject home visits, view patient data, track feedback | ❌ | No admin frontend in this repo. |
| Super Admin: full control, user/content mgmt, analytics | ❌ | Not built. |

## 5. Non-Functional Requirements

| SRS item | Status | Notes |
|----------|--------|-------|
| Load < 3s | ⚠️ | Splash + bootstrap; not formally measured. |
| 1,000+ concurrent users | ⚠️ | FastAPI + Postgres + Redis cache; not load-tested. |
| Secure data + payments | ✅ | Keychain tokens, HMAC payment verify, no card data stored. |
| Simple UI | ✅ | Home decluttered, safe-area tab bar (2026-06-15). |
| Android (initial) | ✅ | Android-first. |

## 6. Data Requirements

| Entity | Status | Notes |
|--------|--------|-------|
| Users | ✅ | `users` (+ OAuth fields). |
| Symptoms | ⚠️ | Represented via `ReliefSession` keys; no dedicated `symptoms` table. |
| Therapy Videos | ✅ | `WellnessSession` / `ReliefSession` / `FaceGlowRoutine` carry `video_url`. |
| Appointments | ✅ | `Appointment` model. |
| Payments | ✅ | Payment order/verify records. |
| Feedback | ✅ | `TherapySession` relief rating + scan feedback. |

## 7. Constraints / 8. Future / 9. Assumptions

- Video-only, Android-first, limited symptom set — **honoured**.
- "No advanced AI/ML in initial release" — repo **goes beyond** the SRS with the OpenCV face-scan pipeline (kept optional/degrading so it never blocks core UX).
- Future (3D, AR, AYUSH, e-commerce) — not started, as expected.
- Assumptions (doctor-supplied content, externally recorded videos, client payment keys) — consistent with current stubs.

## 10. Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| All modules functional and tested | ⚠️ User-app modules ✅/⚠️; admin modules ❌ |
| User completes full therapy flow | ✅ |
| Booking + payment workflows | ⚠️ (payment sandbox) |
| Admin manages content/appointments | ❌ (no admin UI) |

## 11. Privacy Policy

| SRS item | Status | Notes |
|----------|--------|-------|
| Consent-based collection | ✅ | `UserConsent` (scan_storage / ai_training / gdpr_data), consent-gated scan upload. |
| Data deletion / user rights | ✅ | Account delete (cascade) + scan delete (GDPR). |
| Secure cloud storage + encryption | ⚠️ | Cloudinary/local storage; encryption-at-rest depends on provider config. |
| Disclaimer (not medical advice) | ⚠️ | Present in SRS; **surface in-app** (Settings/onboarding) — recommended. |

## 12. Security Policy

| SRS item | Status | Notes |
|----------|--------|-------|
| Encryption in transit / at rest | ⚠️ | TLS in prod; at-rest is provider-dependent. |
| Secure auth (OTP/password) | ⚠️ | Password + JWT refresh ✅; **OTP not implemented**. |
| Role-based access control | ✅ | User/Admin/Super-Admin roles enforced server-side. |
| Payment via 3rd-party gateway, no card storage | ✅ | Razorpay; no sensitive financial data stored. |
| Monitoring / backups / IT-Act compliance | ⚠️ | Operational concerns; not codified in repo. |

---

## Top Gaps vs SRS (recommended next)

1. **Admin & Super-Admin consoles** — native **admin** (`mobile-admin`) and
   **doctor** (`mobile-doctors`) apps now cover doctor/user/appointment/content
   management and clinical workflows; a *web* super-admin console is still unbuilt.
2. **Subscription billing + plan gating** (incl. Free 2-min limit).
3. **Razorpay native checkout** with real test keys.
4. **OTP authentication** (SRS lists OTP/password).
5. **In-app medical disclaimer** surfaced to users.
6. **Seed the 4 missing MVP symptoms** (Knee Pain, Ankle Pain, Migraine, Sciatica) in `seed_data.py`; confirm therapy **repetition/precautions** fields populated.
