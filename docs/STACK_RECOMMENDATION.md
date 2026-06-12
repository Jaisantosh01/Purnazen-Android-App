# Stack Recommendation

**Last updated:** 2026-06-12 (reflects PR #1: `AdditionCode_11June2026_SP`)

Analysis of the current stack and alternatives for the Purnazen wellness Android (+ iOS) app.

---

## Current Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile | React Native (bare workflow) | 0.84.1 |
| Language | JavaScript / TypeScript | TS optional |
| Navigation | React Navigation | 7.x |
| Backend | Flask (Python) | 3.1 |
| Database | PostgreSQL | — |
| ORM | SQLAlchemy + Flask-Migrate | — |
| Auth | Flask-JWT-Extended | 4.7.4 |
| API docs | Flasgger (Swagger) | 0.9.7.1 |

---

## Verdict: Keep the current stack

The current stack is a solid, production-proven choice for this type of app. The architecture is clean on both sides and the team is clearly comfortable with it.

**The stack is not the bottleneck. Missing backend endpoints are.**

That said, below are targeted upgrades worth considering — not a full rewrite.

---

## Progress on Previously Recommended Quick Wins

| Recommendation | Status |
|---------------|--------|
| Set `BASE_URL` in `apiEndpoints.js` | ✅ Done — now `http://10.0.2.2:5000` |
| Move tokens to secure storage | ❌ Still in `AsyncStorage` |
| Connect HomeScreen to real API | ✅ Done — quick relief fetched from backend |
| Add `authService` logout server call | ❌ Still local-only |

---

## Recommended Upgrades (Drop-in, Low Risk)

### 1. Create `src/constants/strings.js` (Urgent)

`HomeScreen.js` imports `STRINGS` from `../constants/strings` but that file does not exist. This will crash the app. Create it immediately:

```js
// src/constants/strings.js
export const STRINGS = {
  HOME_TITLE: 'PurnaZen',
  HOME_SUBTITLE: 'Your wellness journey starts here',
  BANNER_TITLE: 'Premium Wellness Plan',
  BANNER_SUB: 'Unlock all sessions',
  WELLNESS_SECTION: 'Wellness',
  SEE_ALL: 'See All',
  FACE_GLOW_TITLE: 'Face Glow',
  FACE_GLOW_SUB: 'Acupressure facial therapy',
  CONSULT_TITLE: 'Book a Consultation',
  CONSULT_SUB: 'Talk to an expert today',
};
```

### 2. Backend: Migrate Flask → FastAPI (for new endpoints)

| | Flask (current) | FastAPI (recommended) |
|--|---|---|
| Performance | Sync by default, WSGI | Async-native, ASGI |
| Type safety | Marshmallow schemas manually | Pydantic models, automatic |
| API docs | Flasgger (bolted on) | OpenAPI built-in, auto-generated |
| Validation | Marshmallow (separate) | Pydantic (integrated) |
| IDE support | Good | Excellent (full type inference) |
| Migration effort | Medium (2–3 days) | — |

FastAPI generates OpenAPI/Swagger docs automatically from type hints. Pydantic v2 replaces Marshmallow. The existing layered architecture (controllers / services / repositories) maps 1:1.

**Recommended when:** adding the 22 missing endpoints — build new routes in FastAPI, migrate auth last.

---

### 3. Frontend: Add Expo Modules (without full Expo migration)

React Native 0.84 bare workflow is fine. Adding `expo-modules-core` unlocks:

- `expo-secure-store` — replaces `AsyncStorage` for token storage (fixes the biggest security gap)
- `expo-notifications` — simpler push notification setup than raw FCM
- `expo-camera` — needed for Face Glow scan feature
- `expo-updates` — OTA updates without app store re-submission

**Migration effort:** 1–2 hours per package. No architecture change needed.

---

### 4. State Management: Add Zustand (not Redux)

Currently there is no global state. As more backend endpoints come online, prop drilling and re-fetching will compound. Zustand is 1 KB, requires zero boilerplate:

```js
// store/authStore.js
import { create } from 'zustand';
export const useAuthStore = create(set => ({
  user: null,
  token: null,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
}));
```

---

### 5. Backend: Fix Seed Password Hashing

`seed.py` creates doctor users with `password="123456"` as a plain string. The `User` model `__init__` does not hash through the service layer. Verify that `AuthService.register()` (which hashes via bcrypt) is called — or add hashing directly to `seed.py`:

```python
from app.utils.password import hash_password
user = User(
    full_name="Dr Sarah Chen",
    email="sarah@example.com",
    password=hash_password("123456"),
    role="doctor"
)
```

---

### 6. HTTP Client: Switch to Axios (optional)

The custom `httpInterceptor.js` works, but Axios provides the same features with less maintenance: interceptors, automatic JSON parsing, cancellation tokens (useful for debounced search), better error objects.

**Migration effort:** 2–4 hours.

---

### 7. Backend: Add Redis for Token Blocklist

The current `TokenBlocklist` table is a database-backed revocation list. Under load, every authenticated request queries the DB twice. Redis with TTL matching JWT expiry is the standard solution.

**Recommended when:** reaching ~100+ DAU.

---

## Alternatives Considered (and why to stay with current stack)

### Flutter
**Verdict:** Not worth rewriting 17 screens and 5 services. Performance is not the problem.

### Expo Managed Workflow
**Verdict:** Bare workflow is already set up. Use individual Expo packages instead (see point 3 above).

### Node.js / Express Backend
**Verdict:** Python will become an asset once Face Glow ML analysis is implemented. No reason to migrate.

### Firebase (BaaS)
**Verdict:** Vendor lock-in, no SQL joins. Could replace individual pieces (Auth → Firebase Auth, Notifications → FCM) but not the whole backend.

---

## Recommended Upgrade Roadmap

| Phase | Work | Effort |
|-------|------|--------|
| Now | Create `src/constants/strings.js` (app crashes without it) | 30 min |
| Now | Fix seed.py password hashing | 30 min |
| Now | Remove debug `console.log` from `authService.js` | 15 min |
| Phase 1 | Wire frontend logout to call server; move tokens to `expo-secure-store` | 2 hours |
| Phase 2 | Implement P0 backend endpoints (doctor detail, time slots, book appointment, save session) | 1 week |
| Phase 3 | Implement P1 endpoints (therapy history, wellness/relief sessions, profile update) | 1 week |
| Phase 4 | Add Zustand store, connect remaining frontend screens | 3 days |
| Phase 5 | Migrate backend to FastAPI, add Redis blocklist | 3 days |
| Phase 6 | Real payment gateway (Razorpay for India), FCM push notifications | 1 week |
| Phase 7 | Face Glow camera + ML analysis | 2+ weeks |

---

## One-Line Summary

Keep React Native + Flask. Fix the missing `strings.js` immediately (app will crash), add FastAPI for new endpoints, `expo-secure-store` for token security, and Zustand for state. The doctor listing now works end-to-end — the team has a working template to follow for the remaining 22 endpoints.
