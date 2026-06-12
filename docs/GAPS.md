# Frontend ↔ Backend Gaps

**Last updated:** 2026-06-12 (reflects PR #1: `AdditionCode_11June2026_SP`)

This document maps every frontend service call to its required backend endpoint and flags which are implemented, missing, or only partially covered.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Backend endpoint exists and is implemented |
| ❌ | Backend endpoint does not exist |
| ⚠️ | Partially implemented or needs validation |

---

## Auth (`authService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `login(email, password)` | POST | `/api/v1/auth/login` | ✅ | Returns `{ access_token, refresh_token, user }` — frontend updated to match |
| `logout()` | — | (local clear only) | ⚠️ | Clears AsyncStorage but does NOT call `POST /api/v1/auth/logout`. Refresh token stays valid on server. |
| `getUser()` | GET | `/api/v1/auth/me` | ✅ | Implemented |
| `register()` | POST | `/api/v1/auth/register` | ✅ | Implemented |
| `refreshToken()` | POST | `/api/v1/auth/refresh` | ✅ | Exists but not called by frontend yet |
| **Update profile** | PUT | `/api/v1/auth/me` | ❌ | `SettingsScreen` has "Edit Profile" but no PUT endpoint |
| **Change password** | PUT | `/api/v1/auth/password` | ❌ | UI exists in SettingsScreen |
| **Delete account** | DELETE | `/api/v1/auth/me` | ❌ | Danger Zone in SettingsScreen |

---

## Home (`HomeScreen.js` — direct fetch, no service file)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| Quick relief cards | GET | `/api/v1/home/quick-relief` | ✅ **New** | Connected end-to-end. HomeScreen fetches and renders API data. |
| Wellness session rows | — | (no API call) | ⚠️ | HomeScreen uses `FALLBACK_WELLNESS` hardcoded constant. No API call made. |

---

## Consult (`consultService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getDoctors(filter, search, page)` — All | GET | `/api/v1/doctors` | ✅ **New** | Paginated, search by name supported. Filter tabs not yet wired. |
| `getDoctors()` — Available Today filter | GET | `/api/v1/doctors/available-today` | ❌ | `is_available_today` field exists on Doctor model but no filtered endpoint |
| `getDoctors()` — Video Call filter | GET | `/api/v1/doctors/video-call` | ❌ | |
| `getDoctors()` — Home Visit filter | GET | `/api/v1/doctors/home-visit` | ❌ | |
| `getDoctors()` — Top Rated filter | GET | `/api/v1/doctors/top-rated` | ❌ | |
| `getFilterTabs()` | GET | `/api/v1/filter-tabs` | ❌ | |
| `getDoctorDetail(doctorId)` | GET | `/api/v1/doctors/:id` | ❌ | `GET /api/v1/doctors` returns full detail inline but no single-doctor endpoint |
| `getVisitTypes(doctorId)` | GET | `/api/v1/doctors/:id/visit-types` | ❌ | consultation_types relation exists on Doctor model |
| `getTimeSlots(doctorId, date)` | GET | `/api/v1/doctors/:id/time-slots` | ❌ | DoctorAvailability model exists; slot generation logic not implemented |
| `bookAppointment(data)` | POST | `/api/v1/appointments/book` | ❌ | No Appointment model |
| `processPayment(data)` | POST | `/api/v1/payments/process` | ❌ | No Payment model |

---

## Wellness (`wellnessService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getAllSessions()` | GET | `/api/v1/sessions` | ❌ | Falls back to `yogaSessionData.js` |
| `getSession(key)` | GET | `/api/v1/sessions/:key` | ❌ | Falls back to local data |

---

## Relief (`reliefService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getAllReliefSessions()` | GET | `/api/v1/relief-sessions` | ❌ | Falls back to `reliefSessionData.js` |
| `getReliefSession(key)` | GET | `/api/v1/relief-sessions/:key` | ❌ | Falls back to local data |

---

## Therapy History (`therapyService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getTherapyHistory()` | GET | `/api/v1/therapy-history` | ❌ | Falls back to `therapyData.js` |
| `saveSession(data)` | POST | `/api/v1/therapy-history/save` | ❌ | Called on session completion — silently fails |

---

## Face Glow (endpoints defined in `apiEndpoints.js`, no service file yet)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| Fetch routines | GET | `/api/v1/face-glow/routines` | ❌ | Endpoint constant added, no backend |
| Fetch single routine | GET | `/api/v1/face-glow/routines/:key` | ❌ | |
| Start face scan | POST | `/api/v1/face-glow/scan` | ❌ | Button shows alert in FaceGlowScreen |
| Scan history | GET | `/api/v1/face-glow/history` | ❌ | |

---

## Missing Screens / Features (No Backend At All)

| Feature | Frontend Screen | Required Backend Work |
|---------|----------------|----------------------|
| Subscriptions | `SubscriptionsScreen.js` | Payment gateway, subscription plans table, billing API |
| Notifications | `NotificationsScreen.js` | Push notification service (FCM), user preferences table |
| Face Glow Analysis | `FaceGlowScreen.js` | Image analysis API (ML model or 3rd-party) |
| Help — Live Chat | `HelpSupportScreen.js` | Chat integration (e.g. Crisp, Intercom) |

---

## Summary: Endpoint Count

| Category | Needed | Implemented | Gap |
|----------|--------|-------------|-----|
| Auth | 8 | 6 | 2 missing (profile update, delete account) |
| Home | 2 | 1 | 1 missing (wellness sessions) |
| Consult | 10 | 1 | 9 missing |
| Wellness | 2 | 0 | 2 missing |
| Relief | 2 | 0 | 2 missing |
| Therapy | 2 | 0 | 2 missing |
| Face Glow | 4 | 0 | 4 missing |
| **Total** | **30** | **8** | **22 missing** |

---

## Priority Order for Backend Work

### P0 — Blocks core UX
1. `GET /api/v1/doctors/:id` — doctor detail screen shows a blank detail section
2. `GET /api/v1/doctors/available-today` + filter variants — ConsultScreen filters are non-functional
3. `GET /api/v1/doctors/:id/time-slots` — booking calendar has no real slots
4. `POST /api/v1/appointments/book` — booking flow is decorative
5. `POST /api/v1/therapy-history/save` — session data is silently lost

### P1 — Required before any real user data
6. `GET /api/v1/therapy-history` — profile screen shows stale mock
7. `GET /api/v1/sessions` + `GET /api/v1/relief-sessions` — dynamic content
8. `PUT /api/v1/auth/me` + `PUT /api/v1/auth/password` — settings screen broken
9. `POST /api/v1/payments/process` — payment screen is decorative

### P2 — Complete the platform
10. Visit types endpoint
11. Subscription management
12. Notification preferences
13. Face Glow analysis
14. Account deletion

---

## Frontend Issues That Don't Need Backend

These can be fixed without any backend work:

| Issue | Fix |
|-------|-----|
| `src/constants/strings.js` missing — `HomeScreen.js` will crash | Create the file with display string constants |
| `authService.js` has 5+ debug `console.log` calls | Remove before release |
| `logout()` doesn't revoke server-side token | Call `POST /api/v1/auth/logout` before clearing AsyncStorage |
| Tokens in `AsyncStorage` | Migrate to `expo-secure-store` or `react-native-keychain` |
| `BottomNav.js` is unused | Remove or wire it up |
| Wellness rows in HomeScreen always use hardcoded fallback | Connect to `wellnessService.getAllSessions()` |
