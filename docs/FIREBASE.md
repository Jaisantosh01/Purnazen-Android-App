# Firebase Setup (Push Notifications + Social Sign-In)

One Firebase project powers both features:

- **FCM push** — notifications delivered with the app closed (see
  docs/NOTIFICATIONS.md for what gets sent and when).
- **Firebase Authentication** — Google / GitHub sign-in in ALL three apps.
  The backend verifies the Firebase ID token and issues its own JWTs;
  Firebase never becomes the identity store, your Postgres stays authoritative.
  - **Users app**: sign in AND sign up (first social login creates a patient
    account). Buttons on both the Login and Register screens.
  - **Doctors / Admin apps**: sign in ONLY — the backend never creates
    doctor/admin accounts from social login. The provider email must match an
    existing account, or the account must be linked first (below).
  - **Linked accounts** (all apps): Settings → Account → Linked Social
    Account. Links a Google/GitHub identity (any email) to the logged-in
    account so the social button signs into it afterwards. Unlink from the
    same row.

Everything degrades gracefully until configured: notifications stay in-app
only, the social buttons show a friendly "unavailable" message, and password
login is untouched.

## 1. Create the project and register the Android apps

1. Go to https://console.firebase.google.com → **Add project** (name it e.g.
   `purnazen-dev`; Google Analytics optional — off is fine for dev).
2. In the project: **Add app → Android**, once per app:
   - Users app: package name `com.purnazen`
   - Doctors app: package name `com.purnazen.doctor`
   - Admin app: package name `com.purnazen.admin`
3. **REQUIRED for social sign-in:** add each build's signing SHA-1 AND SHA-256
   fingerprints under Project settings → the matching Android app →
   **Add fingerprint**. The Firebase provider flow (`signInWithPopup` →
   native Custom-Tab) verifies the calling app's certificate hash server-side;
   a signature whose hashes are not registered fails with
   `[auth/invalid-cert-hash]`. FCM push works without fingerprints.

   Register BOTH the debug cert (dev builds) and the release/upload cert
   (CI builds) for every app. Debug: `cd mobile-users/android && ./gradlew
   signingReport`. Release: read it straight from a signed APK —
   ```
   apksigner verify --print-certs purnazen-mobile-users-v<ver>.apk
   ```
   All three apps are signed with the same upload keystore, so the release
   fingerprints are identical across them (but each app entry in the console
   needs them added separately).
4. Download each app's **google-services.json** and place it at:
   - `mobile-users/android/app/google-services.json`
   - `mobile-doctors/android/app/google-services.json`
   - `mobile-admin/android/app/google-services.json`
   Gradle applies the Google Services plugin only when the file exists, so
   nothing breaks when it's absent.

## 2. Backend credentials (one env var for FCM + auth verification)

1. Firebase console → Project settings (gear) → **Service accounts** →
   **Generate new private key** → a JSON file downloads.
2. Base64-encode it and put it in `backend/.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON=<base64>
   ```
   PowerShell:
   ```
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("path\to\key.json"))
   ```
3. Restart the backend. This single value enables both FCM sends and
   `POST /auth/social` ID-token verification (the project id inside the JSON is
   used as the token audience; `FIREBASE_PROJECT_ID` in `.env` can override).

## 3. Enable sign-in providers (Authentication)

Firebase console → **Build → Authentication → Get started → Sign-in method**:

### Google
- Enable the **Google** provider, pick a support email, save. That's it —
  no client IDs to copy anywhere; the app uses Firebase's built-in browser
  consent flow, same as GitHub.

### GitHub
1. GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**:
   - Application name: anything (e.g. `Purnazen Dev`)
   - Homepage URL: anything (e.g. the repo URL)
   - **Authorization callback URL**: copy it from the Firebase GitHub provider
     panel — it looks like
     `https://<project-id>.firebaseapp.com/__/auth/handler`
2. Register, then **Generate a new client secret**.
3. Back in Firebase: enable the **GitHub** provider and paste the **Client ID**
   and **Client secret**. Save.

No GitHub values go into this repo, the app, or the backend — Firebase holds
them and runs the OAuth dance in a browser tab.

## 4. Rebuild the apps

Native modules were added (`@react-native-firebase/app`, `messaging`,
`auth`), so a JS-only reload is not enough — rebuild:

```
cd mobile-users && npm install && npm run android
cd mobile-doctors && npm install && npm run android
cd mobile-admin && npm install && npm run android
```

## 5. Restrict the API keys (do this once)

GitHub's secret scanner opens a "Google API Key" alert on the keys inside
`google-services.json` and `GoogleService-Info.plist`. Those keys are not
secrets — they identify the app to Firebase and ship inside every APK and IPA,
so anyone can read them out of a build whether or not the files are committed.
Google says so directly, and the backend never trusts them: it verifies each
Firebase ID token's signature and audience itself
(`backend/app/services/social_auth.py`). Rotating them achieves nothing on its
own; a new key would be just as public the moment it ships.

What does matter is that a key only works from our apps. An **unrestricted**
key is a real problem: copied out of the repo or out of the APK, it lets anyone
call every API enabled on the project and hammer Identity Toolkit (account
creation, credential stuffing) on our quota and our bill.

Prove where the keys stand:

```
scripts/check-api-key-restrictions.sh
```

It calls Identity Toolkit from plain curl — no bundle id, no package signature.
A properly restricted key refuses. If any line says `UNRESTRICTED`, fix it in
**Google Cloud console → APIs & Services → Credentials**
(https://console.cloud.google.com/apis/credentials?project=purnazen-de70c):

**Android key** (`AIzaSyBiWK…`, the one in every `google-services.json`)
- Application restrictions → **Android apps**, one entry per app:
  `com.purnazen`, `com.purnazen.doctor`, `com.purnazen.admin` — each needs the
  SHA-1 of the cert that signs it. Add the debug cert *and* the release cert,
  and, if the app is on Play with Play App Signing, the SHA-1 Play shows under
  Release → Setup → App signing.

  ```
  keytool -list -v -keystore mobile-users/android/app/debug.keystore \
          -alias androiddebugkey -storepass android | grep SHA1
  keytool -list -v -keystore <release.keystore> -alias <alias> | grep SHA1
  ```

**iOS key** (`AIzaSyCkr7…`, the one in every `GoogleService-Info.plist`)
- Application restrictions → **iOS apps**, bundle ids `com.purnazen`,
  `com.purnazen.doctor`, `com.purnazen.admin`.

**Both keys** — API restrictions → *Restrict key*, and select only what these
apps actually use (`app`, `auth`, `crashlytics`, `messaging`):

- Identity Toolkit API — sign-in
- Token Service API — ID-token refresh
- Firebase Installations API — messaging + crashlytics registration
- FCM Registration API — push tokens
- Firebase Remote Config API — only if Remote Config is ever added

Leave everything else off. Adding a Google product later (Maps, Places) means
adding its API here too, or the app gets `API_KEY_SERVICE_BLOCKED`.

Restrictions take a few minutes to propagate; re-run the script until both
lines read `restricted`, then close the GitHub alert as **Won't fix** with a
link to this section. `.github/secret_scanning.yml` keeps the alert from
reopening on every commit that touches a config file.

Rotate a key only if the project's billing or Identity Toolkit quota shows
abuse that predates the restrictions — rotation means new config files in all
three apps and a new release of each.

## What works afterwards

- Users/doctors apps register an FCM token on login; backend pushes
  appointment/payment/reminder/broadcast notifications even when the app is
  closed (docs/NOTIFICATIONS.md).
- All three login screens: **Google** and **GitHub** open a browser consent
  tab (Firebase's provider flow — one code path for every provider).
- Users app only: first social login auto-creates a patient account (random
  unusable password, `auth_provider` recorded); later logins with the same
  email reuse the account, including ones that registered with a password.
- Doctor/admin emails are never auto-created through social login — an
  unknown email gets "No account found". To sign into a doctor/admin account
  whose email differs from the Google/GitHub email, link it first:
  Settings → Account → **Linked Social Account** → Google/GitHub.
- Settings → Account → **Email Address** changes the login email in every
  app (password confirmation for password accounts; linked-provider proof for
  social-created ones).

## Flow reference

```
Login button
  → Firebase sign-in on device (browser consent tab for any provider)
  → app gets the Firebase ID token
  → POST /api/v1/auth/social {id_token, expected_role}
  → backend verifies signature + audience against the Firebase project
  → find user by linked firebase_uid, else by email, else create patient
    (patient app only)
  → backend's own access/refresh tokens (same as password login)

Linking (Settings, any role, while logged in)
  → same device-side Firebase sign-in
  → POST /api/v1/auth/social/link {id_token}
  → binds users.firebase_uid (+ auth_provider) to the current account
  → POST /api/v1/auth/social/unlink removes it
```

Touch points: `backend/app/services/social_auth.py` (verification),
`AuthService.social_login/link_social/unlink_social/change_email`,
`src/services/socialAuthService.js` + login/register buttons and
Settings rows in each app.
