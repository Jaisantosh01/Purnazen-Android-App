# Going Live on Google Play — Services, Costs, Compliance & AI Model Strategy

**Status:** planning document
**Written:** 2026-07-22
**Scope:** all three apps (`com.purnazen`, `com.purnazen.doctor`, `com.purnazen.admin`) + the FastAPI backend
**FX rate used throughout:** USD 1 = INR 88 (round numbers; re-check before budgeting)

> Every price below is either (a) a published list price with a source link, or
> (b) explicitly marked **[estimate]**. Anything quote-only from a vendor is
> marked **[quote]** — do not put those numbers in a budget without a written
> quote.

---

## Table of contents

1. [What the app uses today](#1-what-the-app-uses-today)
2. [What has to change before a public release](#2-what-has-to-change-before-a-public-release)
3. [Payments & subscriptions — the decision that matters most](#3-payments--subscriptions)
4. [Play Store publishing: the how](#4-play-store-publishing-the-how)
5. [Compliance: Play health policy, India DPDP, telemedicine](#5-compliance)
6. [Cost model — three scale tiers](#6-cost-model)
7. [AI models: buy vs. build for face and tongue](#7-ai-models-buy-vs-build)
8. [Making the results look and read professional](#8-making-the-results-professional)
9. [Recommended plan and sequencing](#9-recommended-plan)

---

## 1. What the app uses today

This is the actual inventory, read off the code — not aspirational.

### 1.1 Third-party services already wired in

| Service | Where | What it does | Status |
|---|---|---|---|
| **Firebase Cloud Messaging** | `@react-native-firebase/messaging` (all 3 apps), `backend/app/services/fcm_service.py` | Push notifications when app is closed | Wired, needs prod project |
| **Firebase Authentication** | `@react-native-firebase/auth`, `backend/app/services/social_auth.py` | Google sign-in; backend verifies the ID token and issues its **own** JWTs — Firebase is not the identity store | Wired, GitHub provider removed in the users app |
| **Razorpay** | `backend/app/core/payment_provider.py`, `services/payment_service.py` | Appointment payments. Falls back to a **local sandbox** mode when keys are absent | Wired, sandbox-only today |
| **Azure Container Apps** | `.github/workflows/deploy-backend.yml`, `docs/DEPLOYMENT.md` | Runs the FastAPI backend | Provisioned and verified |
| **Azure Database for PostgreSQL (Flexible, B1ms)** | `DATABASE_URL` | Primary datastore | Provisioned |
| **Azure Blob Storage** | `backend/app/utils/azure_storage.py`, `services/upload_service.py`, `video_service.py` | Session videos (SAS-signed URLs), scan image uploads, **and private APK distribution** (`app-releases` container) | Provisioned |
| **Azure Container Registry** | `az acr build` in CI | Backend image builds | Provisioned |
| **Google Calendar / Meet** | `backend/app/services/google_meet_service.py` | Creates Meet links for video consultations via a service account | Wired, degrades gracefully when unconfigured |
| **Redis** (optional) | `REDIS_URL` | Cross-worker rate limits + JWT blocklist cache | Optional, currently in-memory |
| **GitHub Actions + OIDC** | `.github/workflows/` | Build/deploy/release pipelines | Working |

### 1.2 AI/ML stack — all self-hosted, no vendor

| Component | File | Notes |
|---|---|---|
| MediaPipe FaceLandmarker (478 pts) | `backend/app/ai/face_landmarker.task` | Free, Apache-2.0 |
| Trained skin model (ONNX, 8 heads) | `backend/app/ai/models/skin_model.onnx` (16 MB) | Trained in-house from `backend/ml/train_skin_model.ipynb` on the Kaggle *Facial Skin Analysis* dataset. EfficientNet-B0, masked multi-head loss |
| Classical-CV analyzers (fallback) | `backend/app/ai/analyzers/*.py` | 10 analyzers: pores, wrinkles, pigmentation, hydration, oiliness, dark circles, elasticity, inflammation, muscle tone, toxin |
| Tongue pipeline | `backend/app/ai/tongue/{segmenter,color_analyzer,tcm_rules}.py` | Rule-based TCM mapping — **no trained model** |
| On-device quality gate | ML Kit-based Kotlin `ScanQuality` module | Free |
| Glow score engine | `backend/app/ai/analyzers/glow_score_engine.py` | Weighted composite |

**Cost of the AI stack today: ₹0 in licences.** You pay only for the compute it
runs on. That is a genuinely strong position — see [§7](#7-ai-models-buy-vs-build).

### 1.3 Things that look like services but are not

- **Chat assistant** (`chat_service.py`) is a **DB-driven decision tree**, not an LLM.
  No token costs. If you ever swap it for a real LLM, that becomes a new line item.
- **Subscriptions** (`mobile-users/src/screens/SubscriptionsScreen.js`) are
  **hard-coded UI only** — Free / Premium ₹499 / Pro ₹999. There is no
  subscription model, table, endpoint, or entitlement check on the backend. This
  is the single biggest build gap before monetising.

---

## 2. What has to change before a public release

Ranked by how likely it is to get the app **rejected or removed**, not by effort.

### 2.1 Blocker — the self-update mechanism will get you removed

`docs/OTA_RELEASES.md` describes the app downloading a **signed APK from Azure
Blob via a SAS URL and installing it**. On a Play-distributed app this violates
the *Device and Network Abuse* policy: apps distributed via Play may not download
or install executable code from outside Play, and may not update themselves
outside Play's update mechanism.

**Fix:** for the Play build, disable the APK self-update path entirely.
`updateService.js` should keep polling `/app-releases/latest` for the
*version-check* only, and route the user to the Play Store listing when a newer
version exists (or better, use Play's In-App Updates API). Keep the SAS-download
path behind a build flag for the internal/enterprise distribution of the
**doctor and admin** apps if you distribute those outside Play.

Concretely:
- Users app → Play Store, In-App Updates API, no APK download.
- Doctor/Admin apps → these are staff tools. Consider **Managed Google Play
  (private app)** or keep them off-store entirely and keep the existing SAS
  distribution. That is legitimate for sideloaded enterprise builds.

### 2.2 Blocker — `CORS_ORIGINS` defaults to `*`

`backend/.env.example` says `"*" (default) is for dev only`. Set it explicitly in
the Container App secrets before public traffic.

### 2.3 Blocker — subscriptions have no backend

You cannot ship a paywall screen that charges money with no entitlement model.
Either hide the Subscriptions screen for v1, or build it (see [§3](#3-payments--subscriptions)).

### 2.4 Blocker — health claims and the medical disclaimer

The face scan returns "wellness score", "skin age", inflammation, toxin
indicators, and TCM-derived recommendations. Under Play's *Health Content and
Services* policy, an app that is **not** a registered medical device must carry a
disclaimer that it "does not diagnose, treat, cure, or prevent any medical
condition", and must not make claims contradicting medical consensus.

**Fix:** persistent, non-dismissible disclaimer on every scan result screen and
in the store listing; rename anything that reads as a diagnosis. "Toxin
indicator" in particular reads as a medical claim — rename to something
observational ("skin dullness index").

### 2.5 Required — Play Console declarations

- **Health apps declaration form** (App content section) — mandatory.
- **Data safety form** — must match reality: you collect face images, biometric-adjacent
  data, health data, email, and location (`@react-native-community/geolocation`).
- **Privacy policy** at a public, non-geofenced HTTPS URL (no PDF), linked both in
  Console and inside the app.
- **Account deletion** — Play requires an in-app *and* a web-accessible deletion
  path for any app with accounts.
- **Target API level** — must meet Play's current requirement; verify
  `rootProject.ext.targetSdkVersion` in each `android/build.gradle`.

### 2.6 Required — signing and release hygiene

You already have `purnazen-upload.keystore` and a working signed-release CI. For
Play you additionally want:
- **Play App Signing** enrolled (Google holds the app signing key; your keystore
  becomes the *upload* key — this is what you want, it makes key loss recoverable).
- **AAB, not APK**, for the Play track. Your release workflow currently produces
  both — publish the `.aab`.
- Register the **Play App Signing SHA-1/SHA-256** in Firebase, in addition to the
  upload and debug certs (`docs/FIREBASE.md` §1.3). Miss this and Google sign-in
  fails in production with `[auth/invalid-cert-hash]` — this is the single most
  common "worked in testing, broke on Play" failure.

---

## 3. Payments & subscriptions

This is the part with the most money and the most policy risk, so read it carefully.

### 3.1 The rule

Google Play's Payments policy splits your revenue into two buckets that are
treated *completely differently*:

| Your product | Bucket | Must use | Google's cut |
|---|---|---|---|
| **Doctor consultation booking / fee** | Regulated clinical service by a licensed provider | **Razorpay** — Play billing is explicitly *not* to be used | **0%** |
| **1:1 sessions with a therapist/coach** | 1:1 online service | Razorpay (exempt) | **0%** |
| **Premium/Pro subscription** (unlimited on-demand video sessions, meditation library, personalised plan) | Digital content subscription | **Google Play Billing** (or India user-choice billing) | **15%** — see below |

The Health Content and Services policy states it directly: *"Regulated clinical
service transactions should not use Google Play's billing system; alternative
payment methods are required."* And the Payments policy exempts *"1:1 online
services (music lessons, personal training, counseling)"*.

So: **your consultation revenue is Google-fee-free. Your content-subscription
revenue is not.** Design the plans around that.

### 3.2 India specifics — user choice billing

Following the CCI order, India has **user choice billing**: you may offer an
alternative billing system alongside Play's, and the service fee drops by 4
percentage points — **15% → 11%** (or 30% → 26% above the $1M small-business
threshold, which will not apply to you for a long time).

Doing the arithmetic on a ₹499/month Premium plan:

| Route | Google fee | Razorpay fee | Net to you |
|---|---|---|---|
| Play Billing only | 15% = ₹74.85 | — | **₹424.15** |
| User choice billing (Razorpay) | 11% = ₹54.89 | 2.99% + 18% GST = 3.53% = ₹17.61 | **₹426.50** |

The saving is **₹2.35/month/subscriber** — about 0.5%. It is not worth the
engineering and reporting overhead at launch. **Recommendation: use Play Billing
for the content subscription, Razorpay for consultations.** Revisit user choice
billing only past ~₹10 lakh/month of subscription revenue.

> Note on the June 2026 fee restructure (10% on auto-renewing subscriptions, plus
> a separate 5% billing fee): that launched **only in the US, EEA and UK** on
> 2026-06-30. India is in the "Rest of World" group and is unchanged for now.
> Watch for the expansion announcement.

### 3.3 What you have to build

Backend (nothing exists today):

```
models/subscription_plan.py      id, code, name, price_inr, period, features[], play_product_id
models/user_subscription.py      user_id, plan_id, source(play|razorpay|manual),
                                 purchase_token, status, current_period_end, auto_renewing
services/subscription_service.py entitlement checks + quota enforcement
services/play_billing_service.py verify purchase token via Google Play Developer API,
                                 handle Real-time Developer Notifications (RTDN)
api/v1/endpoints/subscriptions.py  GET /plans, POST /verify, GET /me, POST /webhook/rtdn
```

Key implementation notes:

1. **Never trust the client.** The app sends the Play `purchaseToken`; the
   backend calls `purchases.subscriptionsv2.get` on the Google Play Developer API
   to verify it, then grants entitlement. Same pattern you already use for
   Razorpay signature verification in `payment_service.verify`.
2. **Subscribe to RTDN** (Pub/Sub) for renewals, cancellations, grace periods,
   refunds, and account holds. Without it, a subscriber who cancels keeps access
   forever, and a refunded user keeps access.
3. **Enforce the quotas you advertise.** The Free plan promises "3 wellness
   sessions/month" and Premium "2 doctor consultations/month" — those need
   counters and checks in `wellness_session_service` and `appointment_service`.
4. **Play Billing needs a native module.** Add `react-native-iap` (or
   `expo-in-app-purchases` equivalent for bare RN 0.85) to `mobile-users` only.
5. Doctor and admin apps have no purchases — keep them clean.

Mobile client: `react-native-iap`, ~1 week including the RTDN plumbing and
restore-purchases flow. **[estimate]**

### 3.4 Razorpay activation checklist

- Business KYC: PAN, GST certificate, bank proof, incorporation docs.
- For a healthcare merchant category, Razorpay will ask for the clinical
  establishment registration / practitioner registration numbers.
- Move from `rzp_test_*` to live keys; set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
  as Container App secrets.
- **Add webhook handling.** Right now `payment_service` verifies signatures
  client-side-initiated only. If the app is killed mid-payment, the payment
  succeeds at Razorpay and stays `created` in your DB forever. Add the
  `payment.captured` / `payment.failed` / `refund.processed` webhook — this is a
  correctness bug, not just a nice-to-have.
- Settlement is T+2 by default; instant settlement costs up to 1% extra.

---

## 4. Play Store publishing: the how

### 4.1 Choose the right account type — this matters a lot

| | Personal account | **Organisation account** |
|---|---|---|
| Fee | $25 one-time | $25 one-time |
| Extra requirement | **12 testers opted-in continuously for 14 days** before you can go to production | **D-U-N-S number** (free, ~5–30 days from Dun & Bradstreet) |
| Time to production | 14+ days of closed testing, minimum | No closed-testing mandate |
| Listing shows | Your personal name/address | Company name |

For a healthcare product under a company (Calypsion / PurnaZen), **register an
organisation account**. It skips the 12-tester gate, shows a business name on the
listing — which materially affects install conversion for a health app — and is
required anyway if you ever want Managed Google Play for the doctor/admin apps.

**Start the D-U-N-S request first**; it is the longest-lead item in the whole plan.

The 12-tester requirement applies only to personal accounts created after
2023-11-13 (reduced from 20 testers on 2024-12-11).

### 4.2 Release track sequence

```
Internal testing  →  Closed testing (alpha)  →  Open testing (beta)  →  Production
   ≤100 testers        invite list / groups       public opt-in          staged rollout
   instant             ~hours review              full review            5% → 20% → 50% → 100%
```

Plan for **first production review to take 3–7 days**, longer for a health app
with a medical-device-adjacent feature. Budget two rejection cycles.

### 4.3 Store listing assets you need

| Asset | Spec | Notes |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | |
| Feature graphic | 1024×500 | Shown at top of listing |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | Show the scan result screen — it's the differentiator |
| Tablet screenshots | 7" and 10" | Required if you declare tablet support |
| Short description | 80 chars | |
| Full description | 4000 chars | Avoid diagnosis language here too — the listing is reviewed |
| Promo video | YouTube URL, optional | High conversion impact for scan-based apps |
| Privacy policy URL | Public HTTPS | Also needs to be reachable from inside the app |

**[estimate]** Professional listing assets + ASO copy: ₹15,000–₹50,000 one-time,
or in-house.

### 4.4 CI changes

Your `release-mobile.yml` already produces signed artifacts. To publish
automatically, add a Play publishing step:

- Create a **service account** in Google Cloud, grant it access in Play Console
  (Users and permissions → invite the service account email → *Release manager*
  on the users app only).
- Store the JSON key as a GitHub secret.
- Use `r0adkll/upload-google-play` or `fastlane supply` to push the `.aab` to the
  `internal` track on every tagged release; promote to production manually.

Keep the doctor/admin release jobs on the existing artifact path.

---

## 5. Compliance

### 5.1 Google Play Health Content and Services policy

Enforcement tightened in January 2026. What applies to you:

- **Health apps declaration form** — mandatory in Play Console.
- **Medical Device labelling** — apps regulated as medical devices are labelled
  "Medical Device" on the listing and must supply proof of approval/clearance
  **on request**. You want to stay *out* of this category: don't claim to detect,
  diagnose, or screen for disease. "Skin condition metrics for wellness tracking"
  is fine; "detects skin cancer / diagnoses vitamin deficiency" is not.
- **Disclaimer** — required for non-medical-device health apps (see §2.4).
- **No health profiling from age-restricted signals** — platform-wide ban.
- If you ever add **Health Connect** integration, `READ_HEALTH_DATA_IN_RECORDS`
  now requires proof the data is essential to the primary function.

### 5.2 India — DPDP Act 2023 + DPDP Rules 2025

The Rules were notified **2025-11-13** with an 18-month phased window:

| Phase | Date | What activates |
|---|---|---|
| 1 | notified | Data Protection Board constituted |
| 2 | **2026-11-13** | Consent manager registration |
| 3 | **2027-05-13** | Everything else: consent notices, data principal rights, breach notification, Significant Data Fiduciary obligations. Penalties up to **₹250 crore** |

You have until **May 2027** for full compliance, but the architecture decisions
have to be made now because retrofitting consent granularity is expensive.

What you already have that helps: `user_consent` model, `consent_service.py`,
consent endpoints, and a Consent UI (per `FACE_ANALYSIS_SPEC.md` Sprint 5). Good.

What to add:
- **Purpose-specific consent records** — face image storage vs. model training vs.
  sharing with a doctor must be separately consentable and separately withdrawable.
- **Retention policy + automatic deletion.** Face images are the most sensitive
  thing you hold. Recommendation: store the *derived scores* indefinitely, delete
  the *raw image* after N days (30 is defensible) unless the user opts into
  keeping it for progress comparison.
- **Breach notification path** — a documented process, not code.
- **Data principal rights endpoints**: access, correction, erasure, nomination.
- **DPO / grievance officer** contact published in the app and privacy policy.

### 5.3 India — telemedicine

The **Telemedicine Practice Guidelines, 2020** (appended to the IMC
Professional Conduct Regulations) govern doctor-patient teleconsultation. Key
obligations that touch the product:

- Registered Medical Practitioners only; **display each doctor's registration
  number** in the app. Your `doctor` model should carry it and the profile screen
  should show it.
- Explicit patient consent for teleconsultation — record it.
- Prescription rules: certain drug categories cannot be prescribed via
  teleconsultation. If you add e-prescriptions, this needs real legal review.
- Maintain records of the consultation.

**[estimate]** Legal review (privacy policy, T&C, telemedicine compliance,
DPDP readiness) for an Indian health startup: **₹40,000–₹1,50,000** one-time.
This is not optional spend for a health app.

### 5.4 Security items worth doing before public traffic

- Rotate `SECRET_KEY` / `JWT_SECRET_KEY` for production (never reuse dev values).
- Set `CORS_ORIGINS` explicitly.
- Enable `RATE_LIMIT_ENABLED` with Redis so limits work across replicas.
- Postgres: switch from "allow all Azure services" to a **private endpoint or
  VNet** — the current firewall rule allows every Azure tenant to reach your DB.
- Azure Blob: confirm the scan-image container is private and only ever served
  via short-lived SAS (the video path already does this correctly).

---

## 6. Cost model

Three scenarios. All monthly unless stated. USD 1 = INR 88.

### 6.1 One-time / setup costs

| Item | USD | INR | Notes |
|---|---:|---:|---|
| Google Play developer account | $25 | ₹2,200 | One-time, non-refundable |
| D-U-N-S number | $0 | ₹0 | Free from D&B, allow 5–30 days |
| Domain (`purnazen.com` etc.) | ~$15/yr | ₹1,320/yr | Container Apps managed TLS cert is free |
| Legal — privacy policy, T&C, DPDP/telemedicine review | — | ₹40,000–₹1,50,000 | **[estimate]** |
| Store listing assets + ASO | — | ₹15,000–₹50,000 | **[estimate]**, or in-house |
| Play Billing + subscription backend build | — | ~2–3 dev-weeks | **[estimate]** |
| **Total one-time** | | **₹60,000–₹2,05,000** + dev time | |

### 6.2 Scenario A — Launch (0–1,000 MAU, ~100 scans/day)

| Service | Config | USD/mo | INR/mo | Source |
|---|---|---:|---:|---|
| Azure Container Apps | 1 replica, 1 vCPU / 2 GiB, always-on | ~$67 | ₹5,900 | List rates $0.000024/vCPU-s, $0.000003/GiB-s, minus free grant (180k vCPU-s / 360k GiB-s / 2M req) |
| Azure PostgreSQL Flexible | B1ms + 32 GB + backups | ~$20 | ₹1,760 | ~$12–15 compute + storage |
| Azure Container Registry | Basic | ~$5 | ₹440 | |
| Azure Blob Storage | 100 GB hot | ~$2 | ₹176 | $0.018–0.023/GB-mo |
| Azure egress (video streaming) | ~500 GB, 100 GB free | ~$48 | ₹4,224 | Zone 2 (India) $0.12/GB |
| Log Analytics | minimal retention | ~$10 | ₹880 | **[estimate]** |
| Firebase (Auth + FCM) | <50k MAU | **$0** | **₹0** | Auth free ≤50k MAU; FCM free, unlimited |
| Google Workspace (for Meet links) | 1 Business Starter seat | ~$7 | ₹616 | Meet-via-service-account needs a Workspace domain; free Gmail cannot be impersonated |
| Razorpay | 2% + 18% GST on fee | variable | — | ~2.36% effective |
| **Subtotal** | | **~$159** | **~₹14,000** | |

### 6.3 Scenario B — Growth (10,000 MAU, ~1,000 scans/day)

| Service | Config | USD/mo | INR/mo |
|---|---|---:|---:|
| Container Apps | 2–3 replicas, 1 vCPU / 2 GiB, autoscaled | ~$180 | ₹15,840 |
| PostgreSQL | D2ds_v4 (2 vCPU / 8 GB) + 128 GB | ~$140 | ₹12,320 |
| Redis (Azure Cache, Basic C1) | rate limits + blocklist | ~$40 | ₹3,520 |
| Container Registry | Standard | ~$20 | ₹1,760 |
| Blob Storage | 1 TB hot | ~$21 | ₹1,850 |
| **Egress via CDN** | ~5 TB through Azure Front Door | ~$400 | ₹35,200 |
| Log Analytics + App Insights | | ~$50 | ₹4,400 |
| Firebase | still <50k MAU | **$0** | **₹0** |
| Google Workspace | 3 seats | ~$21 | ₹1,850 |
| **Subtotal** | | **~$872** | **~₹76,700** |

**The dominant cost is video egress, not compute.** At 5 TB/month you are paying
more to ship MP4s than to run the entire backend. Two fixes, in order of value:

1. **Put a CDN in front of Blob** (Azure Front Door / CDN) — cuts origin egress
   and improves playback. Roughly halves effective cost at this scale.
2. **Move video to a purpose-built provider.** Bunny Stream (~$0.01/GB delivery),
   Cloudflare Stream ($1 per 1,000 minutes delivered), or Mux. At 5 TB/month
   Bunny is ~$50 vs Azure's ~$600. **[estimate]** This is the single highest-ROI
   infra change you can make and it does not touch app code — only the URL
   returned by `video_service._process_video_data`.

### 6.4 Scenario C — Scale (50,000 MAU, ~5,000 scans/day)

| Service | USD/mo | INR/mo |
|---|---:|---:|
| Container Apps (API, 4–6 replicas) | ~$400 | ₹35,200 |
| Container Apps (dedicated scan workers, GPU-less, queue-driven) | ~$250 | ₹22,000 |
| PostgreSQL (D4ds_v4 + HA replica) | ~$500 | ₹44,000 |
| Redis (Standard C2) | ~$120 | ₹10,560 |
| Blob + CDN/video provider (~25 TB delivered) | ~$300 | ₹26,400 |
| Observability | ~$150 | ₹13,200 |
| Firebase Auth (50k MAU boundary) | ~$0–30 | ₹0–2,640 |
| **Subtotal** | **~$1,750** | **~₹154,000** |

At this tier, **split the scan pipeline off the API container.** MediaPipe +
ONNX inference is CPU-bound and will starve your request handlers. Put scans on a
queue (Celery is already stubbed in `requirements.txt`) with its own Container App
scaled on queue depth. Costs the same or less and removes the tail-latency
problem.

### 6.5 Revenue side, for reference

At 10,000 MAU with a 3% conversion to Premium (₹499):

```
300 subscribers × ₹499              = ₹149,700 gross
  less Play Billing 15%             = -₹22,455
                                    = ₹127,245 net subscription revenue

Consultations: 200/mo × ₹800        = ₹160,000 gross
  less Razorpay 2.36%               = -₹3,776
  less doctor payout (say 70%)      = -₹112,000
                                    = ₹44,224 net

Total net ≈ ₹171,000/mo  vs  infra ₹76,700/mo
```

**[estimate]** — the conversion rate is the assumption doing all the work here.
3% is optimistic for a cold-start wellness app; 1–1.5% is more typical in year
one. Model it at 1%.

---

## 7. AI models: buy vs. build

### 7.1 The honest assessment of where you are

You already have something most competitors buy: a **trained, exported, 8-head
skin model** running on ONNX Runtime with a graceful classical-CV fallback, plus
an on-device quality gate. The architecture is right. What you're missing is not
a model — it's **labelled data volume and clinical validation**.

The Kaggle dataset you trained on has ~4,093 images but only **~200 labelled
rows** (`skinalaysis_labeling_train1.xlsx` ~150 + `skinanalysis_valid1-2.xlsx`
~50). A multi-head regressor trained on 200 labelled examples will not generalise
across Indian skin tones, lighting, and camera hardware. That — not model
architecture — is what makes results feel unprofessional.

So the buy-vs-build question is really: **buy an API, buy data, or buy nothing
and invest in labelling?**

### 7.2 Face / skin analysis — what you can actually buy

| Vendor | What you get | Deployment | Medical status | Pricing |
|---|---|---|---|---|
| **[Perfect Corp](https://yce.perfectcorp.com/features/skin-analysis-api)** (YouCam) | AI Skin Analysis API; acne, pores, spots, eye bags, wrinkles, redness, moisture, texture; claims 95% test-retest reliability | Cloud API + Web/iOS/Android SDK | Cosmetic, not medical | Credit-based, free trial credits; usage plans reported from ~$5/mo entry. **[quote]** for volume |
| **[Haut.AI](https://haut.ai/product/ai-skin-analysis)** | 150+ skin parameters, 15+ health metrics, live-camera; SaaS *and* server-to-server API | Cloud | Cosmetic | Enterprise, usage-based, **[quote]**. Market-typical entry ₹1.5–4 lakh/yr **[estimate]** |
| **[Revieve](https://www.revieve.com/)** | 200+ metrics incl. hydration, pigmentation, sensitivity; smartphone-optimised | Cloud | Cosmetic | Enterprise **[quote]** |
| **[Orbo.ai](https://orbo.ai/)** | 16+ skin parameters, 6 skin types, 209 facial points | Cloud API | Cosmetic | **[quote]** — **India-based (Mumbai)**, INR billing, most negotiable for an Indian startup |
| **[GlamAR](https://www.glamar.io/solutions/ai-facial-skin-analysis)** (Fynd) | 14+ skin concerns | Cloud SDK | Cosmetic | **[quote]** — also India-based |
| **[AILabTools Skin Analyze](https://api.market/store/ailabtools/skin-analyze)** | Skin colour, texture, wrinkles, acne, dark circles, skin type | Cloud API via api.market | Cosmetic | **10 free calls/mo, from $10/mo** — cheapest real option, good for benchmarking |
| **[Skinive](https://skinive.com/for-developers/)** | 50+ skin issues, 100+ conditions | Cloud **or on-premise** | **CE-marked Class I medical device**, ISO 13485 | **[quote]** |
| **ModiFace** | 20+ skin concerns | SDK | Cosmetic | L'Oréal-owned; effectively brand-partner only, not open to third parties |

**Important:** integrating **Skinive** (a CE-marked medical device) would likely
push your app into Play's **"Medical Device"** label, with a documentation
burden on request. That is a business decision, not a technical one. The
cosmetic-grade vendors (Perfect Corp, Haut.AI, Orbo, GlamAR) keep you in the
wellness category — which is where your product positioning already sits.

**Recommendation for face:**

1. **Immediately (₹880/mo):** subscribe to **AILabTools Skin Analyze at $10/mo**
   and use it purely as a **benchmark**. Run 200 held-out faces through both it
   and your ONNX model. You'll get a hard, quantitative answer to "is my model
   good enough?" for the price of a coffee. Do this before spending anything else.
2. **If your model loses badly:** get quotes from **Orbo.ai and GlamAR first**
   (Indian entities, INR contracts, training data with Indian skin tones, and
   they will negotiate with a startup). Then Perfect Corp and Haut.AI as the
   quality benchmark.
3. **Hybrid architecture (what I'd actually ship):** keep your ONNX model as the
   primary scorer, and add a vendor API as a **second opinion on low-confidence
   scans only**. Your `skin_model.py` already has a clean fallback seam — add a
   third branch. At 10–20% vendor call rate, you get near-vendor quality at
   near-zero vendor cost, and you keep ownership of the pipeline.

### 7.3 Tongue analysis — the harder problem

**There is no commercial, purchasable, Western-market tongue-diagnosis API.**
I looked. The market is:

- **Academic/research systems** — e.g. the [TongueDiagnosis](https://github.com/TonguePicture-SKaRD/TongueDiagnosis)
  stack (YOLOv5 localisation → SAM segmentation → ResNet50 classification →
  LLM consultation layer). Real, working, and architecturally exactly what you'd
  build. Check its licence before any commercial use.
- **Chinese TCM hardware vendors** (tongue-diagnosis instruments) — they sell
  devices with bundled software, not APIs, and rarely license the model.
- **Published datasets** — this is the actual opportunity:
  - **TCM-Tongue**: 6,719 standardised images, **20 pathological symptom
    categories**, labels verified by licensed TCM practitioners, distributed in
    COCO/TXT/XML, benchmarked against twelve models (YOLOv5/v7/v8 variants).
    This is roughly **33× your current labelled face data**, for the modality
    where you currently have *no* model at all.

**Recommendation for tongue:** do not try to buy an API — buy/licence **data**
and train, exactly as you did for skin. Concretely:

1. Licence TCM-Tongue (and any successor academic sets) for commercial use —
   contact the authors; academic dataset commercial licences typically run
   ₹0–₹2,00,000 **[estimate]**, often free with attribution for research-derived
   commercial use, but you must ask in writing.
2. Replace `backend/app/ai/tongue/segmenter.py`'s heuristic segmentation with a
   trained segmentation model (SAM-derived or a small U-Net). Segmentation
   quality is the biggest driver of tongue-colour accuracy and it's the easiest
   win.
3. Keep `tcm_rules.py` as the interpretation layer — a trained classifier
   producing *observations* fed into an explicit, auditable rules table is
   **better** for a health product than an end-to-end black box. You can show
   the user *why*, and a practitioner can review the rules.
4. Reuse `train_skin_model.ipynb` — the masked multi-head loss, EMA, and ONNX
   parity-check export all transfer directly. This is maybe 2–3 weeks of work,
   not a research project. **[estimate]**

### 7.4 Cost comparison of the three strategies

| Strategy | Year-1 cost | Quality | Ownership | Risk |
|---|---|---|---|---|
| **Full vendor** (Perfect Corp / Haut.AI for face, nothing for tongue) | ₹2–6 lakh **[estimate]** | High for face, tongue unsolved | None — you rent | Vendor lock-in, per-scan cost scales with users, no tongue story |
| **Full in-house** (label more data, train both) | ₹1.5–3 lakh (data labelling) + 6–10 dev-weeks **[estimate]** | Depends entirely on data volume | Total | Slow; needs ML discipline; needs a labelling budget |
| **Hybrid (recommended)** | ₹10k benchmark + ₹1–2 lakh data + selective vendor calls | High and improving | You own the pipeline | Modest — best risk-adjusted |

### 7.5 The labelling investment nobody budgets for

If you go in-house (and you should, at least partly), the real line item is
**annotation**:

- 2,000 face images × 8 metrics, dermatologist-reviewed: at ₹40–80/image
  **[estimate]** = **₹80,000–₹1,60,000**.
- Recruit 2–3 dermatologists / cosmetologists for a ₹15,000–₹25,000/month
  part-time review retainer **[estimate]**. This doubles as your clinical
  credibility story in the store listing and to investors.
- Prefer **Indian skin tones and Indian phone cameras** in the sample. This is
  your actual moat against Perfect Corp and Haut.AI, whose training distributions
  skew Western/East-Asian. It is a real, defensible advantage — lean on it.

---

## 8. Making the results professional

The gap between "looks like a toy" and "looks clinical" is mostly **not model
accuracy**. It's presentation and epistemic honesty. In rough order of impact per
unit of effort:

### 8.1 Show uncertainty, always

Right now the pipeline emits point scores. A "Hydration: 62" with no context
reads as fake precision. Instead:

- Emit a **confidence** alongside every metric, derived from image quality
  (`ai/quality.py` already computes the inputs — blur, lighting, face angle,
  occlusion) and, once you have it, model ensemble variance.
- Render as a **band, not a number**: "Hydration: 58–66 (good confidence)".
- **Suppress metrics** whose confidence is below threshold rather than showing a
  bad number. "Couldn't assess pore visibility — try again in brighter light" is
  vastly more credible than a wrong score.

### 8.2 Normative reference ranges

A raw 0–100 is meaningless to a user. Give it a reference frame:

- "Your hydration is **above average for your age group (25–34)**"
- Percentile bands from your own user population, recomputed monthly.
- This requires nothing but a nightly aggregate job over `scan_result`. Highest
  credibility-per-line-of-code in this whole document.

### 8.3 Longitudinal tracking is the actual product

A single scan is a parlour trick. A **12-week trend line** is a health product.
You already have `scan_history` and a scan dashboard — make the trend the hero of
the results screen, not the single-scan score. Also:

- Enforce **consistent capture conditions** for comparability (the auto-capture
  and quality gate from Cycle 6 already do most of this) and flag when a scan
  isn't comparable to the previous one.
- Side-by-side image comparison, same crop, same white balance.

### 8.4 Report design

- **One headline number** (Glow Score) with a plain-English one-liner, then
  progressive disclosure into the 8 metrics.
- Every metric gets: what it is (one sentence), your value, the reference range,
  the trend arrow, and **one specific action**.
- Colour-code by *deviation from personal baseline*, not absolute value — this
  avoids the "everyone is orange" problem.
- Cite the method: "Assessed from 478 facial landmarks across 6 zones using a
  model trained on N dermatologist-labelled images." Users trust methodology
  statements. It also happens to be true, which matters.
- **PDF export** of the report — the single feature that most makes users treat
  the output as legitimate, and it doubles as the artefact they take to a
  consultation. Cheap to build (`reportlab` or an HTML→PDF service).

### 8.5 Human in the loop

The highest-credibility move available to you: **have a real practitioner review
flagged scans**. You already have a doctor app, a doctor roster, and consultation
records. Route low-confidence or high-severity scans into a review queue, and
surface "Reviewed by Dr. X, [registration number]" on the result.

That single feature turns "AI guessed at your face" into "AI-assisted assessment
with clinician oversight" — a completely different product, defensible under
Play's health policy, and a natural upsell into the consultation funnel you
already monetise at 0% Google fee.

### 8.6 Language discipline

Ban this vocabulary from the codebase and UI: *diagnose, detect (a condition),
disease, treatment, cure, prescription, deficiency, toxin*.
Use instead: *assess, indicate, observe, suggest, associated with, wellness
indicator, may benefit from*.

Rename `toxin_indicator.py` and its user-facing string. It is the single most
policy-risky label in the pipeline.

---

## 9. Recommended plan

### Phase 0 — Start the long-lead items today (week 0)

Nothing here blocks on anything else, and two items have multi-week external latency.

- [ ] Apply for a **D-U-N-S number** (5–30 days) → organisation Play account
- [ ] Start **Razorpay live KYC** (healthcare merchant docs take time)
- [ ] Engage a lawyer for privacy policy / T&C / DPDP + telemedicine review
- [ ] Subscribe to **AILabTools at $10/mo** and benchmark your ONNX model against it
- [ ] Email **Orbo.ai** and **GlamAR** for quotes (Indian vendors, fastest replies)
- [ ] Email the **TCM-Tongue** dataset authors about a commercial licence

### Phase 1 — Policy blockers (weeks 1–3)

- [ ] Disable APK self-update in the Play build; switch to In-App Updates
- [ ] Add the medical disclaimer to every scan result screen + store listing
- [ ] Rename diagnosis-adjacent labels (`toxin_indicator` and friends)
- [ ] Lock `CORS_ORIGINS`; rotate prod secrets; enable Redis-backed rate limits
- [ ] Postgres → private endpoint
- [ ] Build the account-deletion flow (in-app + web)
- [ ] Add the Razorpay webhook handler (fixes a real correctness bug)
- [ ] Publish the privacy policy at a public URL

### Phase 2 — Monetisation (weeks 3–6)

- [ ] Subscription models, entitlement service, quota enforcement
- [ ] Play Billing integration (`react-native-iap`) + server-side token verification
- [ ] RTDN webhook for renewals/cancellations/refunds
- [ ] Wire the Subscriptions screen to real plans (or hide it if slipping v1)

### Phase 3 — Store submission (weeks 5–7, overlaps Phase 2)

- [ ] Organisation Play account, Play App Signing enrolled
- [ ] Register Play App Signing SHA-1/SHA-256 in Firebase (do not skip this)
- [ ] Health apps declaration + Data safety form
- [ ] Listing assets, screenshots, ASO copy
- [ ] Internal → closed → open testing
- [ ] Production, staged rollout 5% → 100%

### Phase 4 — Quality and cost (weeks 6–12, continuous)

- [ ] **Move video off Azure egress to Bunny/Cloudflare Stream** — biggest single cost win
- [ ] Confidence bands + metric suppression on low-quality scans
- [ ] Normative percentile ranges from your own population
- [ ] Trend-first results screen + PDF export
- [ ] Practitioner review queue for flagged scans
- [ ] Tongue segmentation model trained on licensed data
- [ ] Split scan inference onto a queue-driven worker Container App

### Budget summary

| | Low | High |
|---|---:|---:|
| One-time (legal, assets, Play, domain) | ₹60,000 | ₹2,05,000 |
| Data licensing + annotation (if in-house ML) | ₹80,000 | ₹3,60,000 |
| Infra, launch scale | ₹14,000/mo | ₹14,000/mo |
| Infra, 10k MAU (with CDN/video fix) | ₹45,000/mo | ₹77,000/mo |
| Vendor ML API, if adopted | ₹880/mo (benchmark) | ₹50,000/mo **[quote]** |

**Realistic year-1 total, launch through ~10k MAU: ₹8–15 lakh**, of which roughly
half is infrastructure and half is one-time legal, data, and content spend.

---

## Sources

- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)
- [Play Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en)
- [Health apps declaration form](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en)
- [Play testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Understanding Google Play's service fee](https://support.google.com/googleplay/android-developer/answer/11131145?hl=en)
- [Understanding user choice billing on Google Play](https://support.google.com/googleplay/android-developer/answer/13821247?hl=en)
- [Billing requirement changes for India](https://support.google.com/googleplay/android-developer/answer/13306652?hl=en)
- [Expanded billing choice and lower fees on Google Play (June 2026)](https://android-developers.googleblog.com/2026/06/play-expanded-billing.html)
- [Publish your health app on Google Play](https://developer.android.com/health-and-fitness/health-connect/publish)
- [Azure Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)
- [Azure Database for PostgreSQL Flexible Server pricing](https://azure.microsoft.com/en-in/pricing/details/postgresql/flexible-server/)
- [Azure bandwidth/egress pricing by zone](https://egresscost.com/azure/zones-explained/)
- [Google Cloud Identity Platform pricing (Firebase Auth MAU tiers)](https://cloud.google.com/identity-platform/pricing)
- [Firebase Authentication docs](https://firebase.google.com/docs/auth)
- [Razorpay payment gateway pricing](https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/)
- [Google Workspace domain-wide delegation](https://developers.google.com/workspace/cloud-search/docs/guides/delegation)
- [DPDP Act 2023 and DPDP Rules 2025 compliance guide (EY India)](https://www.ey.com/en_in/insights/cybersecurity/decoding-the-digital-personal-data-protection-act-2023)
- [With rules finalized, India's DPDPA takes force (IAPP)](https://iapp.org/news/a/with-rules-finalized-india-s-dpdpa-takes-force)
- [Perfect Corp Skin Analysis API](https://yce.perfectcorp.com/features/skin-analysis-api)
- [Haut.AI skin analysis](https://haut.ai/product/ai-skin-analysis)
- [Skinive for developers](https://skinive.com/for-developers/) / [Skinive CE marking](https://skinive.com/ce-marked-app/)
- [AILabTools Skin Analyze on api.market](https://api.market/store/ailabtools/skin-analyze)
- [Best skin analysis APIs (GlamAR vendor roundup)](https://www.glamar.io/blog/best-skin-analysis-api)
- [TongueDiagnosis — YOLOv5 + SAM + ResNet50 TCM system](https://github.com/TonguePicture-SKaRD/TongueDiagnosis)
- [TCM-Tongue: standardized tongue image dataset with pathological annotations](https://www.researchgate.net/publication/393982480_TCM-Tongue_A_Standardized_Tongue_Image_Dataset_with_Pathological_Annotations_for_AI-Assisted_TCM_Diagnosis)
- [Research status of tongue image diagnosis based on machine learning (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S258937772400020X)
