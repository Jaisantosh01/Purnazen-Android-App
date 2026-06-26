# Mobile-Users App — Refinement Audit & Progress Tracker

_Last updated: 2026-06-26. Scope: `mobile-users` (patient app)._

This tracks the in-flight refinement pass: dark-mode coverage, emoji/encoding
fixes, mock/incomplete data, responsiveness, and the profile/permissions epic.

> **Note:** this tracker is **patient-app scoped**. The admin & doctor apps adopted
> the same Profile/Settings system (dark mode, biometric, themed alerts) on
> 2026-06-26 — see [CHANGELOG.md](CHANGELOG.md). Open items below (mock
> subscriptions, sandbox payments, FaceGlow routine player, responsiveness sweep)
> remain live for the patient app.

---

## 0. Environment / dev fixes

| Issue | Fix |
|---|---|
| **Emulator "Network Error"** | Android emulators reach the host at `10.0.2.2`, not `localhost`. `config/index.js` now rewrites a `localhost`/`127.0.0.1` dev URL → `10.0.2.2` on Android (all 3 apps). Production URLs and iOS are untouched. Cleartext HTTP is already allowed in debug builds. |

---

## 1. Dark-mode migration tracker — ✅ COMPLETE (33/33)

Every user-app screen builds its `StyleSheet` from the active palette via
`useTheme()` + `makeStyles(colors)`. A reusable modern `VideoPlayer`
(`components/VideoPlayer.js`) replaced the static player (controls, scrubber,
buffering, fullscreen).

**Migration recipe** (per screen):
1. `import useTheme from '../hooks/useTheme'` (drop static `COLORS` unless used for fixed brand hues).
2. In the component: `const { colors } = useTheme(); const styles = useMemo(() => makeStyles(colors), [colors]);`
3. `const styles = StyleSheet.create(` → `const makeStyles = colors => StyleSheet.create(`; replace `COLORS.` → `colors.` (both JSX and styles).
4. Card surfaces `colors.white` → `colors.card` (+ a `StyleSheet.hairlineWidth` `colors.border` for definition).
5. Colored hero headers → `colors.headerBg` (green) or keep a fixed brand constant (e.g. Wellness accent, FaceGlow magenta).
6. Hardcoded pastel icon backgrounds → `soft(hue)` translucent wash (see SettingsScreen/Notifications).

**Migration recipe** (per screen):
1. `import useTheme from '../hooks/useTheme'` (drop static `COLORS` unless used for fixed brand hues).
2. In the component: `const { colors } = useTheme(); const styles = useMemo(() => makeStyles(colors), [colors]);`
3. `const styles = StyleSheet.create(` → `const makeStyles = colors => StyleSheet.create(`; replace `COLORS.` → `colors.` (both JSX and styles).
4. Card surfaces `colors.white` → `colors.card` (+ a `StyleSheet.hairlineWidth` `colors.border` for definition).
5. Colored hero headers → `colors.headerBg` (green) or keep a fixed brand constant (e.g. Wellness accent, FaceGlow magenta).
6. Hardcoded pastel icon backgrounds → `soft(hue)` translucent wash (see SettingsScreen/Notifications).

---

## 2. Emoji / encoding fixes  ✅ (this pass)

The app standardised on MaterialCommunityIcons; emoji in **backend-served data**
rendered inconsistently or as "?" (esp. the ZWJ doctor emoji 👨‍⚕️).

| Source | Was | Now |
|---|---|---|
| Doctor visit types (`doctor_service.py`) | `📹 🏠 🏥 🩺` | `video-outline`, `home-outline`, `hospital-building`, `stethoscope` (MCIcon names; app already renders `<MCIcon name={visit.icon}>`) |
| Doctor avatar fallback (`doctors.py`) | `👨‍⚕️` | `null` → app shows the doctor's **initial** (`utils/doctorAvatar.js`) |
| Face-glow routine icons (`face_glow_routine.py`) | `🌅 💆 🌙 ✨` (DB column `String(10)`) | mapped by stable `key` → MCIcon names at `to_dict()` (fixes existing DBs, no migration) |
| Recommendation/dashboard text | em/en dashes `— –`, bullets | ASCII-safe (`-`, `*`) to avoid `?` under any encoding |

Frontend: FaceGlowScreen now renders `routine.icon` via `<MCIcon>` (was `<Text>`).
Remaining avatar text-emoji renders to convert during migration:
**BookingConfirmedScreen**, **DoctorProfileScreen** (use `doctorInitial()`).

---

## 3. Mock / incomplete / stubbed features

| Area | Status | Notes |
|---|---|---|
| **Subscriptions** (`SubscriptionsScreen`) | ⚠️ Mock | `PLANS` is fully hardcoded in the screen; not fetched from an API. Needs a plans endpoint + purchase flow. |
| **Payments** (`PaymentScreen`) | 🟡 Sandbox | Razorpay **sandbox** path (`order.sandboxPaymentId`); card/UPI inputs are placeholders. Real keys/flow pending. |
| **Settings → Phone Number** | ⛔ Stub | `Alert.alert('Update Phone', 'Coming soon!')`. No phone field on the user model yet (shows "NA"). |
| **Settings → Language** | ⛔ Stub | `Alert.alert('Language', 'More languages coming soon!')`. English only. |
| **Settings → Download My Data** | 🟡 Stub | Shows a "will be emailed" alert; no export pipeline. |
| **Settings → Location / Privacy toggles** | 🟡 Local-only | `locationAccess` is local state, not persisted/enforced. |
| **BookAppointment → Change Address** | ⛔ Stub | `Alert.alert('Change Address', 'Coming soon!')`. |
| **FaceGlow → routine "play"** | ⛔ Stub | `Alert.alert(routine.title, 'Starting routine!')` — no routine player. |
| Visit types / time slots | ✅ Real | Fetched via `consultService` with sensible fallbacks. |
| `src/data/` | — | Empty (legacy static data moved to backend). |

---

## 4. Responsiveness

Goal: no fixed-width breakage across small (≤360dp) → large/tablet widths.

- Prefer `flex`, percentage widths, and `flexWrap` over fixed pixel widths.
- Grids already use `%` widths (Relief `48%`, FaceGlow benefits `45%`) — OK.
- Audit targets: any `width:`/`height:` in dp on content containers, long text
  without `numberOfLines`, and `Dimensions.get` snapshots that don't react to
  rotation. Convert dialog/screen hero paddings to respect safe-area insets.
- Standard inputs/dialogs now go through `FormInput` / `AppDialog`, which are
  flex-based and keyboard-aware.

---

## 5. Profile & permissions epic (in progress — payment intentionally deferred)

Backend already has `phone`, `gender`, `date_of_birth` columns on `users`
(to_dict exposes them). `address` and `language` are stored in
**`user_preferences`** (JSON) to avoid a schema migration.

| Item | Plan | Status |
|---|---|---|
| **Phone / gender / DOB** | Extend `PUT /auth/me` (UpdateProfileRequest + `update_profile`) to accept them; edit via Settings + the post-signup completion flow. | 🟡 building |
| **Post-signup completion** | After register, route to a **ProfileCompletion** screen (phone, gender, DOB) before entering the app; skippable, re-promptable. | 🟡 building |
| **Settings → Phone** | Replace the "Coming soon" alert with a real editor that persists. | 🟡 building |
| **Language** | Persist in `user_preferences.language`; selector dialog in Settings. (i18n wiring is a later step.) | ⏳ planned |
| **Address** | Persist in `user_preferences.address` (string + optional structured); editor dialog. | ⏳ planned |
| **Location** | OS runtime permission (PermissionsAndroid / geolocation) + persist enabled flag; wire the Settings toggle. | ⏳ planned |
| **Permissions framework** | On first run, request **mandatory** (camera) and **optional** (location, notifications) permissions; persist grant state (AsyncStorage + prefs); a `permissionsService`. | ⏳ planned |
| **Payments** | Intentionally left as-is for now. | ⏸ deferred |

### Remaining (other)
1. Replace `Subscriptions` mock `PLANS` with an API.
2. Resolve remaining "Coming soon" stubs (change address in booking, FaceGlow routine player, Download My Data).
3. Responsiveness sweep (section 4).
