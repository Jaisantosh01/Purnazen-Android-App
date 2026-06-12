# Frontend ↔ Backend Gaps

**Date:** 2026-06-12

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
| `login(email, password)` | POST | `/api/v1/auth/login` | ✅ | Returns access + refresh tokens |
| `logout()` | — | (local clear only) | ⚠️ | Clears AsyncStorage but does NOT call server logout. Token remains valid until expiry. |
| `getUser()` | GET | `/api/v1/auth/me` | ✅ | Implemented |
| `register()` | POST | `/api/v1/auth/register` | ✅ | Implemented |
| `refreshToken()` | POST | `/api/v1/auth/refresh` | ✅ | Exists but not called by frontend yet |
| **Update profile** | PUT | `/api/v1/auth/me` | ❌ | `SettingsScreen` has "Edit Profile" but no PUT endpoint |
| **Change password** | PUT | `/api/v1/auth/password` | ❌ | UI exists in SettingsScreen |
| **Delete account** | DELETE | `/api/v1/auth/me` | ❌ | Danger Zone in SettingsScreen |

---

## Consult (`consultService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getFilterTabs()` | GET | `/api/v1/consult/filter-tabs` | ❌ | Returns hardcoded tabs on backend |
| `getDoctors(filter, search, page)` | GET | `/api/v1/consult/doctors` | ❌ | Falls back to `consultData.js` (2 mock doctors) |
| `getDoctors()` — Available Today filter | GET | `/api/v1/consult/doctors/today` | ❌ | |
| `getDoctors()` — Video Call filter | GET | `/api/v1/consult/doctors/video` | ❌ | |
| `getDoctors()` — Home Visit filter | GET | `/api/v1/consult/doctors/home` | ❌ | |
| `getDoctors()` — Top Rated filter | GET | `/api/v1/consult/doctors/top-rated` | ❌ | |
| `getDoctorDetail(doctorId)` | GET | `/api/v1/consult/doctors/:id` | ❌ | Falls back to mock |
| `getVisitTypes(doctorId)` | GET | `/api/v1/consult/doctors/:id/visit-types` | ❌ | |
| `getTimeSlots(doctorId, date)` | GET | `/api/v1/consult/doctors/:id/slots?date=...` | ❌ | |
| `bookAppointment(data)` | POST | `/api/v1/consult/appointments` | ❌ | Booking Confirmed screen is purely decorative |
| `processPayment(data)` | POST | `/api/v1/consult/payments` | ❌ | Payment screen is purely decorative |

---

## Wellness (`wellnessService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getAllSessions()` | GET | `/api/v1/wellness/sessions` | ❌ | Falls back to `yogaSessionData.js` |
| `getSession(key)` | GET | `/api/v1/wellness/sessions/:key` | ❌ | Falls back to local data |

---

## Relief (`reliefService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getAllReliefSessions()` | GET | `/api/v1/relief/sessions` | ❌ | Falls back to `reliefSessionData.js` |
| `getReliefSession(key)` | GET | `/api/v1/relief/sessions/:key` | ❌ | Falls back to local data |

---

## Therapy History (`therapyService.js`)

| Frontend Call | Method | Endpoint | Status | Notes |
|--------------|--------|----------|--------|-------|
| `getTherapyHistory()` | GET | `/api/v1/therapy/history` | ❌ | Falls back to `therapyData.js` |
| `saveSession(data)` | POST | `/api/v1/therapy/sessions` | ❌ | Called on session completion — silently fails |

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
| Consult | 11 | 0 | 11 missing |
| Wellness | 2 | 0 | 2 missing |
| Relief | 2 | 0 | 2 missing |
| Therapy | 2 | 0 | 2 missing |
| **Total** | **25** | **6** | **19 missing** |

---

## Priority Order for Backend Work

### P0 — Blocks core UX
1. `GET /api/v1/consult/doctors` — app is useless without real doctors
2. `POST /api/v1/consult/appointments` — booking flow is decorative
3. `POST /api/v1/therapy/sessions` — session data is silently lost
4. `GET /api/v1/therapy/history` — profile screen shows stale mock

### P1 — Required before any real user data
5. `GET /api/v1/wellness/sessions` + `GET /api/v1/relief/sessions` — dynamic content
6. `PUT /api/v1/auth/me` + `PUT /api/v1/auth/password` — settings screen broken
7. `POST /api/v1/consult/payments` — payment screen is decorative

### P2 — Complete the platform
8. Doctor detail, visit types, time slots endpoints
9. Filter tabs endpoint
10. Subscription management
11. Notification preferences
12. Account deletion

---

## Quick Fixes That Don't Need Backend

These frontend issues can be fixed without any backend work:

- `authService.js` logout should also call `POST /api/v1/auth/logout` to invalidate the server-side refresh token
- `BASE_URL` in `src/constants/apiEndpoints.js` must be set to the actual backend address
- Tokens stored in `AsyncStorage` should be moved to `react-native-keychain`
- Face Glow "Start Face Analysis" button should be disabled or hidden rather than showing an alert
- `BottomNav.js` component is unused and can be removed or wired up
