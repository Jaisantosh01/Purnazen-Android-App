# Purnazen App — Full-Stack Audit

**Date:** 2026-06-12  
**Status:** Beta UI / Alpha Backend

---

## 1. Project Overview

Purnazen is a wellness and acupressure therapy mobile application. Users can:
- Follow guided yoga, meditation, and breathing sessions
- Use quick-relief acupressure techniques for specific pain points
- Browse and book consultations with doctors
- Track their therapy history and streaks
- Manage a personal wellness profile

**Stack:** React Native 0.84 (frontend) + Flask 3.1 / PostgreSQL (backend)

---

## 2. Backend Audit (`wellness-backend/`)

### Architecture
Clean layered MVC with repository pattern: Routes → Controllers → Services → Repositories → Models.

### What Is Done

| Layer | File | Status | Notes |
|-------|------|--------|-------|
| Entry point | `run.py` | Done | Simple Flask launcher |
| App factory | `app/__init__.py` | Done | Blueprint registration, JWT, Swagger |
| Config | `app/config/config.py` | Done | Loads from `.env` |
| DB extension | `app/extensions/database.py` | Done | SQLAlchemy init |
| JWT extension | `app/extensions/jwt.py` | Done | Flask-JWT-Extended init |
| User model | `app/models/user_model.py` | Done | id, full_name, email, password, role, created_at |
| Token blocklist model | `app/models/token_blocklist_model.py` | Done | JWT logout support |
| User repository | `app/repositories/user_repository.py` | Done | `find_by_email()`, `create_user()` |
| Token repository | `app/repositories/token_repository.py` | Done | `add_to_blocklist()`, `is_token_revoked()` |
| Auth service | `app/services/auth_service.py` | Done | `register()`, `login()` with bcrypt |
| Auth controller | `app/controllers/auth_controller.py` | Done | register, login, logout, me, refresh, admin |
| Auth routes | `app/routes/auth_routes.py` | Done | `/api/v1/auth/*` blueprint |
| Auth validator | `app/validators/auth_validator.py` | Done | Marshmallow `RegisterSchema`, `LoginSchema` |
| Password utils | `app/utils/password.py` | Done | bcrypt hash + verify |
| Response utils | `app/utils/response.py` | Done | `success_response()`, `error_response()` |
| Error handlers | `app/utils/error_handler.py` | Done | 400, 404, 500, ValidationError, Exception |
| Role middleware | `app/middlewares/role_middleware.py` | Done | `role_required()` decorator |
| DB migration | `migrations/` | Done | One migration: create users table |

### Implemented API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | None | Create new account |
| POST | `/api/v1/auth/login` | None | Returns access + refresh tokens |
| GET | `/api/v1/auth/me` | JWT Access | Get current user profile |
| POST | `/api/v1/auth/logout` | JWT Refresh | Revoke refresh token |
| POST | `/api/v1/auth/refresh` | JWT Refresh | Issue new access token |
| GET | `/api/v1/auth/admin/dashboard` | JWT + admin role | Admin-only route |

### What Is Missing (Backend)

- Doctor profiles and management
- Appointment booking and calendar
- Payment processing
- Wellness session catalog (yoga, meditation, breathing, etc.)
- Relief session catalog
- Therapy history recording and retrieval
- User profile update endpoint (`PUT /me`)
- Email / SMS notifications
- CORS configuration
- Rate limiting on auth endpoints
- Database schemas: `doctors`, `appointments`, `sessions`, `payments`

---

## 3. Frontend Audit (`wellness-frontend/`)

### Architecture
React Native screens → Services → HTTP Interceptor → REST API. Mock data fallbacks in `src/data/` for all features.

### Navigation Structure

```
RootStack
├── LoginScreen
└── Main (Bottom Tabs)
    ├── Home Stack  → HomeScreen, SelectSymptom, FaceGlow, YogaSession, ReliefSession
    ├── Relief Stack → ReliefScreen, ReliefSession
    ├── Wellness Stack → WellnessScreen, YogaSession
    ├── Consult Stack → ConsultScreen, DoctorProfile, BookAppointment, BookingConfirmed, Payment
    └── Profile Stack → ProfileScreen, TherapyHistory, HelpSupport, Settings, Subscriptions, Notifications
```

### Screens

| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Login | `LoginScreen.js` | Done | Validation, token storage, error display |
| Home | `HomeScreen.js` | Done | Quick relief cards, wellness cards, face glow, consult CTA |
| Relief | `ReliefScreen.js` | Done | 8-card grid, navigates to ReliefSession |
| Wellness | `WellnessScreen.js` | Done | Stats header, 6 program cards |
| Yoga Session | `YogaSessionScreen.js` | Done | Video player, animated progress, step tracking, cycle support |
| Relief Session | `ReliefSessionScreen.js` | Done | Acupressure steps, 3 cycles, saves on completion |
| Face Glow | `FaceGlowScreen.js` | Partial | UI done; "Start Face Analysis" button shows alert only |
| Consult | `ConsultScreen.js` | Done | Search + debounce, 5 filter tabs, pagination, pull-to-refresh |
| Doctor Profile | `DoctorProfileScreen.js` | Done | Async detail load, error/retry, book CTA |
| Book Appointment | `BookAppointmentScreen.js` | Done | Visit type, calendar, time slots, confirmation |
| Booking Confirmed | `BookingConfirmedScreen.js` | Done | Success screen, proceed to payment |
| Payment | `PaymentScreen.js` | Done | Card / UPI / Wallet, GST calculation |
| Profile | `ProfileScreen.js` | Done | Stats, streak, menu, logout |
| Therapy History | `TherapyHistoryScreen.js` | Done | Stats, session cards, pain progress |
| Settings | `SettingsScreen.js` | Done | Account, notifications, appearance, privacy, danger zone |
| Notifications | `NotificationsScreen.js` | Done | Grouped toggles, recent notifications list |
| Subscriptions | `SubscriptionsScreen.js` | Done | Free / Premium / Pro plans, upgrade alerts |
| Help & Support | `HelpSupportScreen.js` | Done | Contact cards, FAQ accordion, quick links |
| Select Symptom | `SelectSymptomScreen.js` | Done | Searchable symptom list |

### Services

| Service | File | Status | Endpoints Called |
|---------|------|--------|-----------------|
| Auth | `authService.js` | Done | `LOGIN` |
| Consult | `consultService.js` | Done | `DOCTORS`, `DOCTOR_DETAIL`, `VISIT_TYPES`, `TIME_SLOTS`, `BOOK_APPOINTMENT`, `PAYMENT`, `FILTER_TABS` |
| Relief | `reliefService.js` | Done | `ALL_RELIEF_SESSIONS`, `RELIEF_SESSION` (falls back to mock) |
| Wellness | `wellnessService.js` | Done | `ALL_SESSIONS`, `SESSION` (falls back to mock) |
| Therapy | `therapyService.js` | Done | `THERAPY_HISTORY`, `SAVE_THERAPY_SESSION` |

### Components

| Component | Status | Notes |
|-----------|--------|-------|
| `BottomNav.js` | Done | Custom nav bar (currently unused, React Navigation used instead) |
| `QuickCards.js` | Done | Icon card used in HomeScreen |
| Shared theme / StyleSheet | **Missing** | Styles duplicated across 17+ screens |
| Loading skeleton | **Missing** | Blank flash while async data loads |
| Toast / Snackbar | **Missing** | Errors shown via Alert only |
| Error boundary | **Missing** | No global JS error boundary |

### HTTP Interceptor (`src/interceptors/httpInterceptor.js`)

- Done: Bearer token injection, 401/403/404/500 global handling, request/response logging, singleton pattern.

### Constants (`src/constants/apiEndpoints.js`)

- 17 endpoints defined
- `BASE_URL` is a placeholder — must be set per environment

### Mock Data Files (`src/data/`)

All data files are complete with realistic content; used as fallback when API is unavailable.

| File | Content |
|------|---------|
| `consultData.js` | 2 full doctor profiles |
| `reliefData.js` | 8 relief conditions |
| `symptomsData.js` | 8 symptoms |
| `wellnessData.js` | Stats + 6 programs |
| `therapyData.js` | Stats + 6 history sessions |
| `faceGlowData.js` | 4 routines + 6 benefits |
| `yogaSessionData.js` | 6 session types with detailed steps |
| `reliefSessionData.js` | 9 relief sessions with step-by-step instructions |

---

## 4. Scorecard

| Dimension | Score | Reason |
|-----------|-------|--------|
| Architecture | 8/10 | Clean layered backend; clear frontend service pattern |
| UI/UX | 8/10 | Polished screens, consistent color scheme |
| Authentication | 9/10 | JWT, refresh tokens, blocklist, RBAC |
| API Integration | 4/10 | Endpoints defined but backend only implements auth |
| Testing | 0/10 | Zero test files found |
| Documentation | 6/10 | READMEs solid; code-level docs minimal |
| Code Quality | 6/10 | Monolithic screens, no shared theme, some prop drilling |
| Completeness | 5/10 | UI-complete; backend ~10% of needed endpoints |
| Production Readiness | 3/10 | Missing rate limiting, CORS, monitoring, tests, CI/CD |

---

## 5. Security Observations

### Good
- bcrypt password hashing
- JWT with expiration + revocation
- Role-based access control decorator
- Bearer token attached by interceptor

### Needs Attention
- `AsyncStorage` used for tokens (prefer `react-native-keychain` for secure storage)
- No CORS config on Flask backend
- No rate limiting on `/register` and `/login`
- No brute-force protection
- No certificate pinning in mobile app
- `BASE_URL` in plain JS constants (should come from environment variable / build config)

---

## 6. Dependencies

### Backend
```
Flask 3.1.3 | Flask-SQLAlchemy 3.1.1 | Flask-JWT-Extended 4.7.4
Flask-Migrate 4.1.0 | Marshmallow 4.3.0 | bcrypt 5.0.0
psycopg2-binary 2.9.12 | python-dotenv 1.2.2 | Flasgger 0.9.7.1
```

### Frontend
```
React Native 0.84.1 | React 19.2.3 | React Navigation 7.x
@react-navigation/stack | @react-navigation/bottom-tabs
@react-native-async-storage/async-storage
react-native-vector-icons | react-native-video
```
