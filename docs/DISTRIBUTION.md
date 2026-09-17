# Secure Distribution & Updates: Android and iOS

**Written:** 16 September 2026
**Applies to:** `com.purnazen` (Patient), `com.purnazen.doctor` (Doctor),
`com.purnazen.admin` (Admin)

This guide covers getting each app onto the right people's phones on both
platforms, keeping it up to date, and making sure only genuine, signed builds
from us can reach them. It assumes that a public store release may only make
sense for the Patient app, and that the Doctor and Admin apps may stay private.

> Store policies change. Every rule below links to its source; recheck it
> before a release.

---

## 1. Principles

1. **One signing identity per platform, kept in CI.**
   - Android: use Play App Signing. Google holds the app signing key, and our
     upload key lives only in GitHub Actions secrets (`PURNAZEN_UPLOAD_*`).
   - iOS: sign in CI with an App Store Connect API key.
   - Never pass keystores, `.p12` files or API keys through chat or email, and
     never commit them. `.gitignore` already blocks `*.keystore`, `*.jks` and
     `keystore.b64`.
2. **Private does not mean secret.** A private link or an unlisted listing can
   be forwarded to anyone. Access control belongs in the backend:
   - Role-gated login (`expected_role`, already built).
   - Invite-only staff accounts.
   - Two-factor authentication for admins.
   - Firebase App Check.
3. **Store-mediated updates wherever possible.** Play and the App Store verify
   signatures, update automatically and handle rollback. Our own mechanisms
   only point users to the store; they never install anything.
4. **A kill switch.** `/app-releases/latest` with `force_update` already
   stops outdated builds from being used. Keep it for every channel.

---

## 2. Recommended channel per app

| App | Audience | Android | iOS |
|---|---|---|---|
| **Patient** | Public | **Google Play production**: internal → closed → production, with staged roll-out | **TestFlight → App Store** |
| **Doctor** | Onboarded practitioners (tens to hundreds) | **Play closed testing** limited to a Google Group of approved doctors. If partner clinics use device management, a **Managed Google Play private app** instead | **Unlisted App Store distribution**, with TestFlight external groups for betas |
| **Admin** | Internal staff (fewer than 20) | **Play internal testing** (up to 100 testers), or a **Managed Google Play private app** | **TestFlight internal testing** (up to 100 App Store Connect users) for day-to-day use, or **Unlisted** for long-term stability |

Fallback for both staff apps: **Firebase App Distribution**, invite-only
(§4). Use it for QA builds, or if the Play Console or Apple account is not
ready yet.

### Why these channels

- **Play testing tracks** are free with the Play Console account. Updates
  arrive through the normal Play mechanism, and access is controlled by email
  list or Google Group. Internal testing allows up to 100 testers. Closed
  testing allows up to 2,000 users per email list, and Google Groups can be
  used for larger audiences.
  [Play Console Help: testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334)
- **Managed Google Play private apps** are visible only to the organisations
  you name (up to 1,000 organisation IDs per app), and are deployed by those
  organisations' device-management consoles. A private app **cannot later be
  made public**; that would need a new package name.
  [Play Console Help: publish private apps](https://support.google.com/googleplay/android-developer/answer/9874937)
- **Unlisted App Store distribution** suits limited audiences such as
  employees, partners and franchisees. The app goes through normal App Review
  but is reachable only by direct link. It is not shown in search, charts or
  categories, and updates follow the normal release process. It is not for
  betas. Apple advises in-app controls against unauthorised use, which our
  role-gated login provides.
  [Apple: unlisted app distribution](https://developer.apple.com/support/unlisted-app-distribution)
- **TestFlight:**
  - Up to 100 internal testers, who must be App Store Connect users.
  - Up to 10,000 external testers, invited by email or public link.
  - The first build for external testers needs Beta App Review.
  - Each build expires **90 days** after upload, so a staff app kept on
    TestFlight needs a new upload at least every 90 days.

  [Apple: TestFlight](https://developer.apple.com/testflight/)
- **Apple Business Manager custom apps** are an alternative for the Doctor app
  if the clinics are organisations enrolled in Apple Business Manager.
- **Not recommended: the Apple Developer Enterprise Program.** It covers
  in-house distribution to employees only; doctors outside the company would
  breach its terms.

---

## 3. Security controls for every channel

| Control | Where | Status |
|---|---|---|
| Role-gated login (`expected_role=doctor/admin`) | Backend | Done |
| Token revocation (`token_version`) and refresh rotation | Backend | Done |
| Staff accounts created only by an admin. Public `/auth/register` always creates a patient (`RegisterRequest` has no role field) | Backend, Admin app | Done |
| TOTP two-factor authentication for admins | Backend, Admin app | Phase 2 |
| **Firebase App Check** (Play Integrity on Android, App Attest on iOS), enforced on auth, scan upload and staff endpoints | All apps, backend | Phase 2 |
| Keychain or Keystore token storage and biometric unlock | All apps | Done |
| Release signing fails without a real key; R8 obfuscation | Android | Done |
| Crash reporting (Crashlytics) to spot tampered or broken builds | All apps | Done |
| Forced update (`force_update`) as a kill switch | Backend, all apps | Done |
| TLS only; `NSAllowsArbitraryLoads=false` | All apps | Done |
| Publish the release certificate's SHA-256 fingerprint in the internal wiki, so testers who sideload can check it | Android | Phase 3 |

---

## 4. Sideloading (Android) and ad hoc builds (iOS)

Use these only for QA, or while store accounts are pending.

**Firebase App Distribution**:
[docs](https://firebase.google.com/docs/app-distribution) ·
[limits](https://firebase.google.com/docs/app-distribution/troubleshooting)

- Testers are added by invitation (500 per project, 200 per group; Firebase
  can raise the limit on request). Releases expire after 150 days.
- Upload **signed release** APKs from the `release-mobile` workflow. Never
  upload debug-signed builds.
- iOS needs an **ad hoc** provisioning profile containing each tester's device
  UDID (Firebase collects them). Apple caps this at 100 devices per device
  type per membership year, and testers on iOS 16 or later must turn on
  Developer Mode.
- The App Distribution *in-app new-build alerts* SDK can prompt testers to
  update. Include it **only in a separate pre-release build flavour, never in
  the Play build**: the Play build must not update itself outside Play.

**Android developer verification** (Google):
[Android Developer Console Help](https://support.google.com/android-developer-console/answer/16561738)

- Enforcement starts on **30 September 2026** in Brazil, Indonesia, Singapore
  and Thailand, and expands **globally in 2027**. From then on, certified
  devices will only install APKs from outside Play if the developer is
  verified.
- Before 2027: verify the Calypsion Innovations developer identity, and
  register the three package names and their signing certificates in the
  Android Developer Console.
- ADB installs by developers are exempt, and so are apps deployed by an
  organisation's own store to its managed devices.

**Do not** host raw APK download links on a public website or send them in
WhatsApp groups. Once shared, a link cannot be recalled.

---

## 5. Updates

| Channel | How users get updates | What we add |
|---|---|---|
| Google Play (every track) | Play auto-updates | **Play In-App Updates API**: *immediate* mode when `force_update` is set, *flexible* mode otherwise. It replaces today's `market://` banner on Android (Phase 3) |
| App Store and Unlisted | App Store auto-updates | The existing `UpdateBanner` opening `itms-apps://…` (needs the App Store ID) |
| TestFlight | Auto-update when the tester has it enabled | Re-upload at least every 90 days; notify testers on each build |
| Firebase App Distribution | Email or tester app, plus in-app alerts (pre-release flavour only) | Keep the `force_update` banner as a backstop |

### Optional: JavaScript-only hotfixes (`expo-updates`)

The apps already use Expo modules, so `expo-updates` can deliver
JavaScript-only fixes between store releases. Both stores allow this:

- **Google Play** exempts code that runs in an interpreter.
  [Play policy](https://support.google.com/googleplay/android-developer/answer/16559646)
- **Apple** allows downloaded interpreted code, provided it does not change the
  app's primary purpose, create a storefront, or bypass OS security.

Rules if this is adopted:

1. **Sign every update.** EAS Update code signing requires the EAS
   Production or Enterprise plan
   ([Expo](https://docs.expo.dev/eas-update/code-signing/)). A self-hosted
   server can implement the same signed protocol; Expo's reference server
   ([expo/custom-expo-updates-server](https://github.com/expo/custom-expo-updates-server))
   shows how, but it is a demonstration, not production-ready.
2. Only bug fixes, copy changes and existing-feature tweaks. **No payment-flow
   changes and no new features** go through this path.
3. Tie each update to a *runtime version*. Native changes always go through
   the store.
4. Roll out to a percentage of users first, and keep a one-command rollback.

The removed OTA *APK* installer must **not** come back in any
Play-distributed build ([CHANGELOG](CHANGELOG.md), 2026-09-12).

---

## 6. Release runbook (per app, per release)

1. Bump the version. `versionCode` is derived from it on Android; set the
   matching build number on iOS.
2. Android: run **Release Mobile Apps** (`release-mobile.yml`) to produce the
   signed AAB and APK, the GitHub Release and the version registration.
3. iOS: archive and upload to TestFlight. This is manual until the Phase 1 CI
   job lands.
4. Promote the build:
   - Android: internal → closed → production, rolling out 10 → 50 → 100 %.
   - iOS: TestFlight → submit for review → phased release.
5. Watch Crashlytics for 24–48 hours. If a build is bad, halt the roll-out
   and set `force_update` towards the fixed build.
6. Record the release in [CHANGELOG.md](CHANGELOG.md).
