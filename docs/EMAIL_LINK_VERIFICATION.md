# Email verification via Firebase email link (passwordless OTP step)

This is the design + ready-to-paste code + setup checklist for adding a
**Firebase email-link verification step** to sign-up and sign-in in all three
apps, as chosen for the "ask for OTP too" requirement.

It is written as a guide rather than wired into the apps because it **cannot be
completed or tested without the Firebase console and native deep-link config**
(see the checklist). The email-domain validation half of the request (block
disposable / random domains, soft messages) is already implemented and live —
see "What is already done" at the bottom.

Why email link and not a 6-digit code: this reuses the Firebase Authentication
the apps already ship (`@react-native-firebase/auth` ^25.1.0 + a
`google-services.json` in each app) and the backend's existing
`POST /auth/social` verifier — no new email-sending infrastructure. The
trade-off is that it needs deep-link handling to catch the tapped link back in
the app; a backend-issued 6-digit code would avoid that but needs an SMTP/
provider. If you'd rather go that route, say so and it's a smaller change.

---

## The flow

The link proves the user controls the inbox. It reuses the exact backend path
the social buttons already use, so no backend endpoint is strictly required.

```
Sign up / Sign in
  → validate email (already implemented: syntax + disposable + MX)
  → auth().sendSignInLinkToEmail(email, actionCodeSettings)   [Firebase sends the email]
  → store email in AsyncStorage, show "Check your inbox"
  → user taps the link in their email
  → the link opens the app (deep link / app link)
  → auth().isSignInWithEmailLink(link) === true
  → auth().signInWithEmailLink(email, link)                    [email now verified by Firebase]
  → cred.user.getIdToken()
  → POST /api/v1/auth/social { id_token, expected_role }       [EXISTING endpoint]
  → backend finds the account by firebase_uid, else by email, else
    (patient app only) creates it → returns app access/refresh tokens
```

For sign-**up** with a password: run the link step first to prove the email,
then call `POST /auth/register` as today. Because the email is proven before the
account exists, no `email_verified` column is required. (If you want a hard gate
that also covers password logins made on other devices, add the optional
`email_verified` column in the "Optional backend gate" section.)

---

## 1. Client service (ready to paste)

Create `src/services/emailLinkAuth.js` in **each** app (identical). It degrades
gracefully — if Firebase/email-link isn't configured yet, `sendLink` throws a
friendly message, exactly like the social buttons do today.

```js
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from './authService';

const STORAGE_KEY = 'emailForSignIn';

// Must be an authorized domain in Firebase console → Authentication → Settings.
// With Dynamic Links deprecated, use an https continue URL you control (a
// Firebase Hosting page is simplest) plus Android/iOS app-link config so the
// tapped link reopens the app. See the setup checklist.
const actionCodeSettings = {
  handleCodeInApp: true,
  url: 'https://<your-project>.web.app/verify', // your authorized continue URL
  android: { packageName: '<this app package>', installApp: true },
  // iOS: { bundleId: '<this app bundle>' },
};

export async function sendLink(email) {
  try {
    await auth().sendSignInLinkToEmail(email.trim(), actionCodeSettings);
    await AsyncStorage.setItem(STORAGE_KEY, email.trim());
    return true;
  } catch (e) {
    if (e?.code === 'auth/operation-not-allowed' || e?.code === 'auth/unauthorized-continue-uri') {
      throw new Error('Email verification is not set up yet. Please try again later.');
    }
    throw new Error(e?.message || 'Could not send the verification email.');
  }
}

// Call from your deep-link handler when the app opens with a URL.
// `expectedRole`: 'patient' | 'doctor' | 'admin' (as each app already sends to /auth/social).
export async function completeLink(link, expectedRole) {
  if (!auth().isSignInWithEmailLink(link)) return null;
  const email = await AsyncStorage.getItem(STORAGE_KEY);
  if (!email) throw new Error('Open the link on the same device you signed up on.');
  const cred = await auth().signInWithEmailLink(email, link);
  const idToken = await cred.user.getIdToken();
  await AsyncStorage.removeItem(STORAGE_KEY);
  // Reuses the existing social exchange → backend JWTs (see authService.socialLogin).
  return authService.socialLogin(idToken, expectedRole);
}
```

`authService.socialLogin(idToken, expectedRole)` already exists in each app's
`src/services/authService.js` (it's what the Google button calls). If the name
differs, point `completeLink` at whatever wraps `POST /auth/social`.

## 2. Deep-link handler (App entry)

In each app's root (where navigation is set up), catch the incoming URL:

```js
import { Linking } from 'react-native';
import { completeLink } from './src/services/emailLinkAuth';

// EXPECTED_ROLE is 'patient' (users), 'doctor' (doctors), 'admin' (admin).
useEffect(() => {
  const handle = async ({ url }) => {
    try { await completeLink(url, EXPECTED_ROLE); } catch (e) { /* toast e.message */ }
  };
  Linking.getInitialURL().then(url => url && handle({ url }));
  const sub = Linking.addEventListener('url', handle);
  return () => sub.remove();
}, []);
```

On success the auth store flips and the app navigates in exactly like today.

## 3. Wire into the screens

- **Register** (users, admin): after the email passes `quickEmailIssue` and the
  password checks, call `sendLink(email)` and show a "we emailed you a link"
  state instead of calling `register` immediately. Call `register` (or rely on
  `completeLink` → `/auth/social`) once the link is confirmed.
- **Login** (all three): add a "Sign in with email link" button that calls
  `sendLink(email)`; completion is handled by the deep-link handler.

Keep password login untouched as the primary path — this is an added option/step.

---

## Setup checklist (the parts only you can do)

These are why this isn't wired in yet — none can be done or tested from the repo:

1. **Firebase console → Authentication → Sign-in method:** enable
   **Email/Password** and turn on **Email link (passwordless sign-in)**.
2. **Firebase console → Authentication → Settings → Authorized domains:** add the
   domain used in `actionCodeSettings.url` (e.g. your `*.web.app` Hosting site).
3. **Continue URL:** host a page at that URL (a one-line Firebase Hosting page is
   fine). Dynamic Links are shut down (Aug 2025), so the link is a plain https
   URL that your app-link config intercepts.
4. **Android app links:** add an intent-filter for the URL host to each app's
   `AndroidManifest.xml` and publish `/.well-known/assetlinks.json` on the host
   with each app's package + signing SHA-256. (SHA-256s are already gathered for
   social sign-in — see docs/FIREBASE.md §1.3.)
5. **iOS (if/when built):** Associated Domains capability + `apple-app-site-association`.
6. Rebuild all three apps (native config change): `npm run android` per app.

Once 1–6 are done, paste the two code blocks above, wire the screens, and it
works end-to-end. Ping me to do the code wiring — it's ~1 file + 2 small screen
edits per app.

---

## Optional backend gate (`email_verified`)

Only needed if you want to **block password logins** until the email is verified
(e.g. a signup on one device, login on another). Otherwise skip it — proving the
email before account creation already covers same-device signup.

- Add `email_verified BOOLEAN NOT NULL DEFAULT FALSE` to `users` (alembic
  migration — mind the multi-head note in docs/RUNNING.md §1.3).
- New endpoint `POST /auth/verify-email {id_token}`: verify via
  `social_auth.verify_firebase`, match `profile["email"]` to the account, set
  `email_verified = True`.
- In `AuthService.login`, if `not user.email_verified and user.auth_provider is
  None`, return a specific `409`/flag so the app shows "verify your email" +
  resend, instead of signing in.

---

## What is already done (live now)

Implemented and tested against the running backend — no setup needed:

- **Disposable/throwaway domains blocked** (mailinator, guerrillamail, yopmail,
  temp-mail, …) with a soft message: *"Please use a permanent email (like Gmail,
  Yahoo or Outlook)…"*. `backend/app/utils/email_validation.py`.
- **Random/non-existent domains blocked** via an MX lookup (best-effort, never
  blocks on a pure network failure). Real providers (Gmail/Yahoo/Outlook/…) pass.
- **Backend:** `AuthService.register` validates + normalizes the email;
  `POST /auth/validate-email` gives the apps a live soft check.
- **All three apps:** instant offline check (syntax + common disposables) with an
  inline hint on the email field (`quickEmailIssue`); register (users/admin) and
  login (all three) call it, and the backend message flows through on submit.
