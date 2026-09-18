# Project Status & Delivery Plan

**As of:** 18 September 2026 · branch `refactorWithEnhancements_12Sep_AG`
**Scope:** the three mobile apps (Patient, Doctor, Admin) on **Android and iOS**,
the shared FastAPI backend, and the *Face Glow — AI Facial Health & Beauty
Tracker* product brief.

Companion documents: [FEATURES.md](FEATURES.md) (feature-by-feature
inventory) · [TASKS.md](TASKS.md) (backlog) ·
[DISTRIBUTION.md](DISTRIBUTION.md) (secure distribution and updates) ·
[GO_LIVE_PLAYSTORE.md](GO_LIVE_PLAYSTORE.md) (store compliance and costs).

---

## 1. Headline

| | Estimate |
|---|---|
| **Overall completion** | **≈ 69 %** |
| Android (all three apps) | ≈ 80 % — feature-complete for v1; blocked on store accounts and listings, not code |
| iOS — Patient app | ≈ 59 % — builds and runs in the Simulator; no signed device build yet |
| iOS — Doctor and Admin apps | ≈ 50 % — build and run in the simulator, configured like the Patient app; no signed device build yet |
| Backend | ≈ 81 % — deployed on Azure; hardening items open |
| Face Glow brief — core analysis (items 1–12) | ≈ 79 % |
| Face Glow brief — premium and growth features (items 13–24) | ≈ 29 % |

### How the percentages are calculated

Each app–platform pair is scored as **60 % feature build + 40 % release
readiness**. On iOS, the shared JavaScript features only count at half weight
until the app has run on iOS at least once, because they have not been tested
there yet. The Face Glow scores count each item in §4 as 1 (done), 0.5 (partial)
or 0 (not started). These are engineering estimates, not measurements. Use them
to compare areas and track trends, not to set deadlines.

| App | Platform | Features | Release readiness | Completion |
|---|---|---|---|---|
| Patient (`mobile-users`) | Android | 85 | 70 | **79** |
| Patient (`mobile-users`) | iOS | 75 | 35 | **59** |
| Doctor (`mobile-doctors`) | Android | 90 | 65 | **80** |
| Doctor (`mobile-doctors`) | iOS | 70 | 25 | **52** |
| Admin (`mobile-admin`) | Android | 90 | 65 | **80** |
| Admin (`mobile-admin`) | iOS | 70 | 25 | **52** |
| Backend | Azure | 85 | 75 | **81** |

---

## 2. Verified on 17 Sep 2026

| Check | Result |
|---|---|
| Backend `pytest` (SQLite) | **287 passed**, 7 skipped (the skipped tests need live Azure storage) |
| Patient app: jest / tsc / eslint | **123 tests passed** · tsc clean · 0 lint errors (6 warnings) |
| Doctor app: jest / tsc / eslint | **54 tests passed** · tsc clean · 0 lint errors (3 warnings) |
| Admin app: jest / tsc / eslint | **90 tests passed** · tsc clean · 0 lint errors (4 warnings) |
| Backend size | 204 routes across 33 endpoint modules |
| iOS, all three apps | Built with Xcode 27 and run on the iPhone Air simulator against a local backend on 17 Sep: sign-in, dashboards, Settings, two-step enrolment → challenge → recovery code (Doctor), Manage → Quick Relief / Support Contacts / Patient Feedback (Admin), Home / Relief / Wellness / Consult / Profile and the native Sign in with Apple sheet (Patient). Guide in [RUNNING_IOS_MACOS.md](RUNNING_IOS_MACOS.md) |

The remaining lint warnings are all `react/no-unstable-nested-components`
(components declared inside a render). They do not affect behaviour.

**Shared design system (18 Sep).** The three apps now share one visual
language, built from four byte-identical components under
`src/components/` in each app — `TabBar` (pill-highlighted bottom tabs),
`TabHeader` (scrolling hero on tab roots, with an optional stats strip),
`ScreenHeader` (fixed header on pushed screens; `background` prop for feature
sub-brands such as the magenta scan screens) and `EmptyState` (icon / title /
hint / action, used for every "nothing here" and error-with-retry block) —
plus `SkeletonLoader` and `utils/cardTheme.js` for the tinted 2-up grids.
Profile screens use grouped cards; Doctor Dashboard and Admin Home use the
hero + stats + tinted tiles layout of the Patient Wellness tab. When one of
these components changes, copy it to the other two apps.

---

## 3. What is done

**Backend.** JWT authentication with revocation, Firebase-verified Google sign-in,
and role gates. Doctors, availability, leaves and slots. Booking with GST
snapshots. Payments with HMAC verification (sandbox only). Therapy sessions,
history and feedback. Chat decision tree and video groups. The face and tongue
scan pipeline: MediaPipe, 10 analyzers, an ONNX skin model, YOLO tongue
detection and a recommendation engine. Consent management. FCM push delivery
and a reminder scheduler. Legal pages served as HTML. Production configuration
refuses to start with unsafe settings. Azure Container Apps deployment through
OIDC CI.

**Patient app.** 39 screens. Covers account management and biometric unlock,
consults and booking, sessions and videos, face and tongue scans with results,
dashboard, trends, comparison, history and deletion. Also consent, push
notifications, dark mode, the medical disclaimer, Crashlytics and the
store-update banner.

**Doctor app.** 29 screens. Covers the dashboard, appointments, schedule and
availability, leave, patients, clinical records (notes, diagnosis and
prescription), patients' face and tongue scan reports, notifications, and
profile and settings.

**Admin app.** 29 screens. Covers doctors (including clinic location), users,
appointments, slots and leaves, metadata, roles, videos and video groups,
session content, legal pages, FAQs, broadcast notifications, GST settings, and
profile and settings.

**Android release pipeline.** Signing fails if the release key is missing.
`versionCode` is derived from the version number. R8 is on. Crashlytics is
wired in. A manual `release-mobile` workflow produces signed AABs and APKs.
CI runs pytest, and runs jest, tsc and eslint for all three apps.

---

## 4. Face Glow brief: coverage

| # | Brief item | Status | Notes |
|---|---|---|---|
| 1 | Face scan with consent and quality gate | Done | Live quality preview, auto-capture, mesh overlay |
| 2 | Skin metrics (hydration, oil, wrinkles, pigmentation, dark circles, pores, elasticity, inflammation, brightness) | Done | 10 analyzers plus a trained ONNX model |
| 3 | Facial muscle tone by region (forehead, cheek, jaw, under-eye, smile symmetry) | Partial | `muscle_tone_score` is one symmetry-based number, and **the app never displays it** |
| 4 | Skin-type label (dry, oily, combination, sensitive, acne-prone) | Partial | The underlying metrics exist, but the app shows no type label |
| 5 | "Toxin indicators" | Done (reframed) | Renamed to *skin dullness index* and disclaimed, because a toxin score would be an unsupportable health claim |
| 6 | Glow Score 0–100 with category breakdown | Done | Weighted composite from `glow_score_engine.py` |
| 7 | Progress tracker (trends, before/after) | Partial | Trends and any-two-scan comparison are done. Day 1 / Week 1 / Month 1 / Month 3 milestone views are not |
| 8 | Recommendations (hydration, skin care, lifestyle) | Done | Rule-based engine, stored per scan |
| 9 | Beauty dashboard | Done | `ScanDashboardScreen` |
| 10 | Google, Apple and email login | Done | Email, Google and Sign in with Apple (`AppleSignInButton`, iOS only; needs the Apple capability once the bundle IDs are registered) |
| 11 | Privacy: encryption, GDPR | Done | Consent, deletion request and "Download my data" (JSON export behind a 10-minute link, 18 Sep) |
| 12 | Keeping photos for research | Done | `ai_training` consent scope; photos are uploaded only with consent |
| 13 | Freemium subscription (₹499 per month) | Not started | Plans exist at ₹0 and purchases are refused (402) until store billing exists |
| 14 | Face yoga routines | Partial | The routine catalog exists; the play button is a stub |
| 15 | AI beauty coach | Not started | |
| 16 | Personalised skin-care plan | Partial | Recommendations are per scan; there is no multi-day plan |
| 17 | Glow challenges, streaks, badges and points | Not started | A "streak alerts" notification setting exists, but nothing backs it |
| 18 | 30-day glow transformation (daily selfie, before/after video) | Not started | |
| 19 | Share result | Partial | Text-only share; no image card |
| 20 | "Inside-out glow" lifestyle check-ins (sleep, water, stress) | Not started | |
| 21 | Face fitness score and guided exercises | Partial | Score is computed but hidden; no exercise player |
| 22 | Glow Expert (practitioner consult) | Done | Doctor booking and video consults; doctors can see patients' scan reports |
| 23 | Growth loop (glow buddies, group or corporate challenges) | Not started | |
| 24 | Scale to millions (queue, cache, monitoring) | Partial | Redis is optional; scans run as BackgroundTasks; no Celery or Sentry |

### Answers to the questions raised in the brief

- **"Can we store the pictures for our research?"** Yes, but only with
  explicit, separate consent, which is already built (the `ai_training`
  consent scope). Before using photos to train models:
  - Keep the consent text specific about what is kept and for how long.
  - Strip EXIF metadata.
  - Store training copies apart from the user-facing copies.
  - Honour withdrawal of consent by deleting the photo from the training set.

  India's DPDP Act (and GDPR for EU users) treats face images as personal data.
  Have a lawyer review the consent wording.
- **"₹499 per month?"** The price is a business decision; these are the
  mechanics that affect it:
  - A digital subscription sold inside the app must go through **Google Play
    Billing** and **Apple In-App Purchase**.
  - Store prices in India include GST, and the stores take their fee from the
    amount after tax. Google Play charges 15 % on subscriptions. Apple charges
    15 % if you join the Small Business Program; otherwise it takes 30 % in a
    subscriber's first year.
  - At 15 %, ₹499 nets roughly **₹360** per subscriber per month
    (499 ÷ 1.18 × 0.85). Confirm this against real payout reports.
  - Price points must map to each store's price tiers.
  - Doctor consultations are real-world services, so they can keep using
    Razorpay.

  Consider testing ₹299 against ₹499 with a 7-day trial once billing exists
  (Phase 4).

---

## 5. Remaining work in phases

Durations assume the current team size. Phases 1 and 2 can run in parallel.

### Phase 0: Housekeeping and accounts (≈ 1 week, now)

- [ ] Review and commit the pending iOS work on this branch (reviewed and
      verified in the simulator on 17 Sep; commit is pending your go-ahead).
- [ ] Open a **Google Play Console organisation account** and an **Apple
      Developer Program organisation account**. Both need a D-U-N-S number.
- [ ] Register the bundle IDs: `com.purnazen`, `com.purnazen.doctor` and
      `com.purnazen.admin`.
- [ ] Choose a distribution channel for each app (see
      [DISTRIBUTION.md](DISTRIBUTION.md) §2).
- [ ] Create an App Store Connect API key and store it as a GitHub secret.
      Never commit the key or send it in chat.

### Phase 1: iOS parity for all three apps (≈ 2–3 weeks)

- [x] **Doctor and Admin:** apply the Patient app's iOS set-up (17 Sep; both
      apps now build and run in the simulator):
  - Podfile: static frameworks, `$RNFirebaseAsStaticFramework`,
    `RCT_USE_PREBUILT_RNCORE=0`.
  - Fetch `GoogleService-Info.plist` with `scripts/ios-firebase-config.sh`.
  - Call `FirebaseApp.configure()` in `AppDelegate` (Crashlytics runs at JS
    start-up, so the app crashes without it).
  - Add `UIAppFonts` for the vector icons, a privacy manifest, an app icon and
    a launch screen.
- [x] **Admin:** Xcode target and scheme renamed to `PurnazenAdmin`.
- [x] **Patient:** **Sign in with Apple** (`expo-apple-authentication` → Firebase
      `apple.com` credential → `POST /auth/social`). Enable the Apple provider in
      Firebase and the capability on the App ID once the account exists.
- [ ] Upload an APNs authentication key to Firebase so push notifications work
      on iOS.
- [ ] Set `IOS_APP_STORE_ID` in each app's `src/config` once the App Store
      Connect records exist, so the update banner opens the right listing.
- [ ] Build a signed device build of each app, then upload each to TestFlight.
- [x] macOS CI job: `.github/workflows/release-ios.yml` + `scripts/archive-ios.sh`
      archive and upload to TestFlight (needs the ASC API key secrets).

### Phase 2: Release hardening and compliance (≈ 2 weeks)

- [ ] **Firebase App Check.** It uses Play Integrity on Android and App Attest
      on iOS. Enforce it on login, scan upload and every staff-app endpoint.
- [x] **Two-step verification (TOTP)** for any account, enforced per role via
      `MFA_REQUIRED_ROLES` (17 Sep): backend `/auth/mfa/*`, encrypted secrets,
      recovery codes; Doctor and Admin apps have the code screen at sign-in and
      enrolment in Settings.
- [x] Shorter token lifetimes for staff roles (18 Sep): refresh tokens for
      `STAFF_ROLES` (admin, doctor) last `STAFF_REFRESH_TOKEN_EXPIRE_DAYS`
      (1 day) instead of 30. Staff accounts stay invite-only.
- [ ] Provision Azure Cache for Redis so rate limits and the token blocklist
      hold across replicas. Add the 5-per-minute limit on scan uploads.
- [ ] Add Sentry (or Azure Monitor), structured timing logs and
      `/health/detailed`.
- [x] "Download my data" export (18 Sep): `POST /users/me/data-export` mints a
      10-minute link to `GET /users/me/data-export.json` — profile, addresses,
      consents, preferences, subscriptions, payments, appointments, therapy
      history and scans (images by storage path). Settings → Download My Data
      opens it in the browser. Images themselves are not bundled.
- [ ] Run the analyzer test matrix (lighting, skin tones, angles) and load-test
      100 concurrent scan uploads.
- [ ] Get the privacy policy and terms reviewed by a lawyer. Prepare store
      listing assets and the data-safety and privacy-label answers.
- [x] Doctor and admin therapy-feedback review screens; admin quick-relief and
      support-contact screens.
- [x] ESLint warnings cleared (18 Sep): 315 inline-style / unused-code warnings
      across the three apps down to 18 `react/no-unstable-nested-components`
      (components defined inside render; harmless, left for a later pass).

### Phase 3: Distribution roll-out (≈ 1–2 weeks, after Phases 1 and 2)

- [ ] **Patient app:**
  - Android: Play internal → closed → production with staged roll-out.
  - iOS: TestFlight → App Store.
- [ ] **Doctor and Admin apps:** follow the private channels in
      [DISTRIBUTION.md](DISTRIBUTION.md).
- [x] Android uses the **Play In-App Updates** API (`InAppUpdateModule.kt`,
      immediate flow); the banner stays on iOS. `force_update` remains the
      kill switch.
- [ ] Optional: add signed JavaScript-only hotfixes with `expo-updates` (see
      DISTRIBUTION.md §5).

### Phase 4: Monetisation (≈ 2–3 weeks)

- [ ] Google Play Billing and StoreKit 2 subscriptions.
- [ ] Server-side receipt verification with the Play Developer API and the
      App Store Server API, plus Real-Time Developer Notifications and App
      Store Server Notifications v2.
- [ ] An `entitlements` model. Gate premium features (extended trends,
      comparison, coach) on it.
- [ ] Re-price the plans, which removes the 402 guard for verified purchases.
- [ ] Go live with Razorpay checkout for consultations.

### Phase 5: Face Glow v2 engagement features (≈ 4–6 weeks)

- [ ] Show muscle tone and add a regional breakdown (forehead, cheeks, jaw,
      under-eye, smile). Add the skin-type label.
- [ ] Face yoga and face fitness routine player (video plus timed steps).
- [ ] Milestone comparison: Day 1, Week 1, Month 1, Month 3.
- [ ] Share card rendered as an image (`react-native-view-shot`).
- [ ] Streaks, badges, glow points and the 7-, 21-, 30- and 90-day challenges.
- [ ] Daily wellness check-ins (sleep, water, stress) and a Glow Balance
      score.
- [ ] AI Glow Coach: start rule-based on scans and check-ins; add an LLM later
      as a budgeted line item.
- [ ] 30-day transformation: daily standardised selfie and a generated
      before/after video.

### Phase 6: Growth and platform (ongoing)

- [ ] Glow Buddies and group challenges (family, friends, corporate wellness).
- [ ] Practitioner marketplace (B2B), analytics events and an admin analytics
      view.
- [ ] Celery worker for the scan pipeline. Decide whether a web admin console
      is still in scope.

---

## 6. Risks to watch

1. **Health claims.** Keep every face metric framed as a visual wellness
   estimate. Do not bring back "toxin" or diagnostic wording.
2. **iOS review.** Sign in with Apple, specific permission strings, a privacy
   manifest and demo credentials for the reviewer are all mandatory.
3. **Android developer verification.** It reaches all countries in 2027. Any
   APK installed outside Play must come from a verified developer. See
   DISTRIBUTION.md §4.
4. **Hard-coded development defaults.** `backend/app/core/config.py` still
   contains a development database password. Production refuses placeholder
   secrets, but the default should move to `.env.example` only.
