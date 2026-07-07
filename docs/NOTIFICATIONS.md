# Notification System

End-to-end notification pipeline across the backend and all three apps.

## What gets notified

| Trigger | Recipient(s) | Category |
|---|---|---|
| Patient books an appointment | Doctor | `appointment` |
| Doctor/admin confirms (`booked`) | Patient | `appointment` |
| Anyone cancels | The other party (actor is never notified) | `appointment` |
| Doctor completes | Patient (with feedback nudge) | `appointment` |
| Payment verified / failed | Patient (+ doctor on success) | `payment` |
| Appointment starting soon | Patient + doctor | `reminder` |
| Admin broadcast | Chosen audience (all / patients / doctors) | `promo` or `system` |

## Delivery pipeline

```
event → NotificationService.notify()
  → global admin switch (notification_settings, admin app → Home → Notifications)
    → user preference (user_preferences.push_enabled + per-toggle JSON)
      → in-app row (notifications table — the bell feed in users/doctors apps)
      → FCM push to every registered device token (works with the app closed)
```

Rules:
- Transactional categories (`appointment`, `payment`, `reminder`, `system`) always
  create the in-app row; user preferences only mute the device push.
- `promo` fully respects the user's "Offers & Deals" opt-out (default **off**) —
  no row, no push.
- A global admin switch that is off drops the category entirely, for everyone.
- Notification failures never break the business action that triggered them.

## Reminders / schedule

A lightweight asyncio loop (started in the FastAPI lifespan,
`app/services/reminder_scheduler.py`) runs every minute and notifies both
parties of appointments starting within the admin-configured lead window
(`notification_settings.reminder_lead_minutes`, default 60, editable in the
admin app). `appointments.reminder_sent_at` guarantees exactly-once delivery.

## REST surface (`/api/v1/notifications`)

- `GET ""` — my feed (+ `unreadCount`), `?unreadOnly=&limit=&offset=`
- `PATCH /{id}/read`, `POST /read-all`, `DELETE /{id}`
- `POST /device-tokens` — register FCM token `{token, platform, app}`
- `POST /device-tokens/remove` — unregister (logout)
- Admin: `GET|PUT /admin/settings`, `POST /admin/broadcast`
  `{title, body, audience: all|users|doctors, category: promo|system}`

## Enabling device push (Firebase) — one-time setup

Everything is wired; push activates as soon as the Firebase config is present.
Without it the apps run normally with in-app notifications only.

1. **Create a Firebase project** at https://console.firebase.google.com (one
   project for all apps).
2. **Add two Android apps** to the project with the package names of the
   users and doctors apps (see `applicationId` in each
   `android/app/build.gradle`). Download each app's `google-services.json`.
3. **Drop the files into the repos**:
   - `mobile-users/android/app/google-services.json`
   - `mobile-doctors/android/app/google-services.json`
   The Gradle config applies the Google Services plugin only when the file
   exists, so builds never break without it.
4. **Backend credentials**: Firebase console → Project settings → Service
   accounts → *Generate new private key*. Base64-encode the JSON and set it in
   `backend/.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_JSON=<base64 of the service-account json>
   ```
   (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("key.json"))`)
5. Rebuild the two apps. On login each app requests the Android 13+
   notification permission, fetches its FCM token and registers it via
   `POST /device-tokens`. Logout unregisters it.

Closed-app delivery needs no headless JS: the backend sends a `notification`
payload, which Android displays in the system tray via the FCM SDK.

## App entry points

- **Users app**: Home header bell (badge = unread count) → Notification Center.
  Per-user toggles: Profile → Notifications (existing screen — the backend now
  enforces those toggles).
- **Doctors app**: Dashboard header bell → Notification Center.
- **Admin app**: Home → Management → Notifications — broadcast composer,
  global category switches, reminder lead time.
