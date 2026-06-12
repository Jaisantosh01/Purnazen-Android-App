# Stack Recommendation

**Date:** 2026-06-12

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

The current stack is a solid, production-proven choice for this type of app. The architecture is clean on both sides and the team is clearly comfortable with it. The gaps are feature gaps, not architecture gaps.

**The stack is not the bottleneck. Missing backend endpoints are.**

That said, below are targeted upgrades worth considering — not a full rewrite.

---

## Recommended Upgrades (Drop-in, Low Risk)

### 1. Backend: Migrate Flask → FastAPI

| | Flask (current) | FastAPI (recommended) |
|--|---|---|
| Performance | Sync by default, WSGI | Async-native, ASGI |
| Type safety | Marshmallow schemas manually | Pydantic models, automatic |
| API docs | Flasgger (bolted on) | OpenAPI built-in, auto-generated |
| Validation | Marshmallow (separate) | Pydantic (integrated) |
| IDE support | Good | Excellent (full type inference) |
| Migration effort | Medium (2–3 days) | — |

FastAPI generates OpenAPI/Swagger docs automatically from type hints — no manual Flasgger annotations needed. Pydantic v2 replaces Marshmallow. The existing layered architecture (controllers / services / repositories) maps 1:1.

**Recommended when:** adding the 19 missing endpoints — build new routes in FastAPI, migrate auth last.

---

### 2. Frontend: Add Expo Modules (without full Expo migration)

React Native 0.84 bare workflow is fine. However, adding `expo-modules-core` unlocks useful packages without migrating to managed Expo:

- `expo-secure-store` — replaces `AsyncStorage` for token storage (fixes the biggest security gap)
- `expo-notifications` — simpler push notification setup than raw FCM
- `expo-camera` — needed for Face Glow scan feature
- `expo-updates` — OTA updates without app store re-submission

**Migration effort:** 1–2 hours per package. No architecture change needed.

---

### 3. State Management: Add Zustand (not Redux)

Currently there is no global state. As more backend endpoints come online, prop drilling and re-fetching will compound. Zustand is 1 KB, requires zero boilerplate, and is a drop-in for this codebase:

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

Redux Toolkit would also work but is heavier than this app needs.

---

### 4. HTTP Client: Switch to Axios (optional)

The custom `httpInterceptor.js` works, but Axios provides the same features with less maintenance:

- Request/response interceptors
- Automatic JSON parsing
- Cancellation tokens (useful for debounced search)
- Better error objects

**Migration effort:** 2–4 hours to replace `httpInterceptor.js` and update all services.

---

### 5. Backend: Add Redis for Token Blocklist

The current `TokenBlocklist` table is a database-backed revocation list. Under load, every authenticated request queries the DB twice (get user, check blocklist). Redis with TTL matching the JWT expiry is the standard solution:

```python
# Check revocation in O(1) with automatic expiry
redis_client.set(jti, "revoked", ex=token_expiry_seconds)
```

**Recommended when:** reaching ~100+ DAU.

---

## Alternatives Considered (and why to stay with current stack)

### Flutter

**Pros:** Better rendering performance, single Dart codebase, excellent animation APIs  
**Cons:** Requires full rewrite, team is clearly in React Native, ecosystem less mature for wellness/therapy domains  
**Verdict:** Not worth rewriting 17 screens and 5 services. Performance is not the problem here.

### Expo Managed Workflow

**Pros:** Easier setup, OTA updates, unified SDK  
**Cons:** Less control over native modules, larger bundle, ejecting is painful later  
**Verdict:** The bare workflow is already set up and fine. Use individual Expo packages instead (see point 2 above).

### Node.js / Express Backend

**Pros:** Same language as frontend, large ecosystem  
**Cons:** The Flask backend is well-structured and working. Python is preferred for future ML features (face glow analysis)  
**Verdict:** No reason to migrate. Python will become an asset once Face Glow analysis is implemented.

### Firebase (BaaS)

**Pros:** Realtime DB, auth, push notifications, storage in one service  
**Cons:** Vendor lock-in, cost unpredictable at scale, no SQL joins for complex queries  
**Verdict:** Could replace individual services (Auth → Firebase Auth, Notifications → FCM) but not the whole backend. Only worth it if the team has no backend developer.

---

## Recommended Upgrade Roadmap

| Phase | Work | Effort |
|-------|------|--------|
| Now | Set `BASE_URL`, move tokens to `expo-secure-store` | 2 hours |
| Phase 1 | Implement 6 P0 backend endpoints in Flask (or FastAPI) | 1 week |
| Phase 2 | Add Zustand store, implement remaining 13 backend endpoints | 2 weeks |
| Phase 3 | Migrate backend to FastAPI, add Redis blocklist | 3 days |
| Phase 4 | Integrate real payment gateway (Razorpay for India), FCM push notifications | 1 week |
| Phase 5 | Face Glow camera + ML analysis | 2+ weeks |

---

## One-Line Summary

Keep React Native + Flask. Add FastAPI for new endpoints, `expo-secure-store` for token security, and Zustand for state. Those three changes address every major gap without a rewrite.
