# Purnazen App — Full-Stack Audit

**Last updated:** 2026-06-12 (reflects PR #1: `AdditionCode_11June2026_SP`)  
**Status:** Beta UI / Active Backend Development

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

### Models

| Model | File | Status | Key Fields |
|-------|------|--------|-----------|
| User | `app/models/user_model.py` | Done | id, full_name, avatar_url *(new)*, email, password, role, created_at |
| TokenBlocklist | `app/models/token_blocklist_model.py` | Done | jti, created_at |
| Doctor | `app/models/doctor_model.py` | Done | user_id (FK), specialty_id (FK), about, education, experience_years, consultation_fee, average_rating, reviews_count, is_available_today |
| Specialty | `app/models/specialty_model.py` | Done | name, description |
| Clinic | `app/models/clinic_model.py` | Done | doctor_id (FK), name, address, city, lat/long, phone, is_primary |
| DoctorAvailability | `app/models/doctor_availability_model.py` | Done | doctor_id (FK), day_of_week, start_time, end_time, slot_duration_minutes |
| Award | `app/models/award_model.py` | Done | doctor_id (FK), title, issuer, year, description |
| Expertise | `app/models/expertise_model.py` | Done | name |
| Language | `app/models/language_model.py` | Done | name |
| ConsultationType | `app/models/consultation_type_model.py` | Done | name |
| DoctorExpertise | `app/models/doctor_expertise_model.py` | Done | Association table (doctor ↔ expertise) |
| DoctorLanguage | `app/models/doctor_language_model.py` | Done | Association table (doctor ↔ language) |
| DoctorConsultationType | `app/models/doctor_consultation_type_model.py` | Done | Association table (doctor ↔ consultation_type) |
| QuickRelief | `app/models/quick_relief_model.py` | Done | name, slug, title, subtitle, icon_name, icon_url, background_color, text_color, sort_order, is_active |

### Repositories

| Repository | File | Status | Methods |
|-----------|------|--------|---------|
| UserRepository | `app/repositories/user_repository.py` | Done | `find_by_email()`, `create_user()` |
| TokenRepository | `app/repositories/token_repository.py` | Done | `add_to_blocklist()`, `is_token_revoked()` |
| DoctorRepository | `app/repositories/doctor_repository.py` | Done | `get_doctors(page, limit, search)` — paginated + name search |
| QuickReliefRepository | `app/repositories/quick_relief_repository.py` | Done | `get_active_quick_reliefs()` — ordered by sort_order |

### Services

| Service | File | Status | Methods |
|---------|------|--------|---------|
| AuthService | `app/services/auth_service.py` | Done | `register()`, `login()` |
| DoctorService | `app/services/doctor_service.py` | Done | `get_doctors(page, limit, search)` |
| HomeService | `app/services/home_service.py` | Done | `get_quick_reliefs()` — serialises QuickRelief list |

### Controllers

| Controller | File | Style | Methods |
|-----------|------|-------|---------|
| auth_controller | `app/controllers/auth_controller.py` | Class | register, login, logout, me, refresh_token, admin_dashboard |
| doctor_controller | `app/controllers/doctor_controller.py` | Function | `get_doctors()` — reads page/limit/search from query params |
| HomeController | `app/controllers/home_controller.py` | Class | `get_quick_relief()` |

### Implemented API Endpoints

| Method | Path | Auth | Status | Notes |
|--------|------|------|--------|-------|
| POST | `/api/v1/auth/register` | None | Done | Create account |
| POST | `/api/v1/auth/login` | None | Done | Returns access + refresh tokens |
| GET | `/api/v1/auth/me` | JWT Access | Done | Current user profile |
| POST | `/api/v1/auth/logout` | JWT Refresh | Done | Revoke token |
| POST | `/api/v1/auth/refresh` | JWT Refresh | Done | New access token |
| GET | `/api/v1/auth/admin/dashboard` | JWT + admin | Done | Admin-only |
| GET | `/api/v1/doctors` | None | **New** | Paginated doctor list, `?page=&limit=&search=` |
| GET | `/api/v1/home/quick-relief` | None | **New** | Quick relief cards for Home screen |

### Database Migrations

| File | Description |
|------|-------------|
| `migrations/versions/<hash>_create_users_table.py` | Initial users table |
| `migrations/versions/<hash>_add_avatar_url_in_user_table_created_.py` | Adds avatar_url to users |
| `migrations/versions/<hash>_create_doctor_module_tables.py` | All doctor-related tables |
| `migrations/versions/<hash>_create_quick_reliefs_table.py` | quick_reliefs table |

### Seed Data (`seed.py`)

Seeds a working development database with:
- 3 specialties: Acupressure Specialist, Wellness Expert, Pain Management
- 3 consultation types: Video Call, Home Visit, Clinic Visit
- 4 languages: English, Hindi, Mandarin, Kannada
- 11 expertise areas: Pain Management, Stress Relief, Migraine Treatment, Sports Injuries, etc.
- 3 doctor users + 3 doctor profiles (Dr Sarah Chen, Dr Rajesh Kumar, Dr Priya Sharma)

Run with: `python seed.py`

### What Is Missing (Backend)

- Individual doctor detail endpoint (`GET /api/v1/doctors/:id`)
- Doctor filtering by availability/type (`/today`, `/video`, `/home`, `/top-rated`)
- Appointment booking (`POST /api/v1/appointments`)
- Payment processing (`POST /api/v1/payments`)
- Wellness session catalog endpoints
- Relief session catalog endpoints
- Therapy history endpoints
- User profile update (`PUT /api/v1/auth/me`)
- Password change endpoint
- Account deletion endpoint
- CORS configuration
- Rate limiting

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
| Home | `HomeScreen.js` | **Updated** | Fetches quick relief from `GET /api/v1/home/quick-relief`; loading state; wellness rows static fallback |
| Relief | `ReliefScreen.js` | Done | 8-card grid |
| Wellness | `WellnessScreen.js` | Done | Stats header, 6 program cards |
| Yoga Session | `YogaSessionScreen.js` | Done | Video player, animated progress, step tracking, cycle support |
| Relief Session | `ReliefSessionScreen.js` | Done | Acupressure steps, 3 cycles, saves on completion |
| Face Glow | `FaceGlowScreen.js` | Partial | UI done; "Start Face Analysis" shows alert only |
| Consult | `ConsultScreen.js` | Done | Search + debounce, 5 filter tabs, pagination, pull-to-refresh |
| Doctor Profile | `DoctorProfileScreen.js` | Done | Async detail load, error/retry, book CTA |
| Book Appointment | `BookAppointmentScreen.js` | Done | Visit type, calendar, time slots |
| Booking Confirmed | `BookingConfirmedScreen.js` | Done | Success screen, proceed to payment |
| Payment | `PaymentScreen.js` | Done | Card / UPI / Wallet, GST |
| Profile | `ProfileScreen.js` | Done | Stats, streak, menu, logout |
| Therapy History | `TherapyHistoryScreen.js` | Done | Stats, session cards, pain progress |
| Settings | `SettingsScreen.js` | Done | Account, notifications, appearance, privacy, danger zone |
| Notifications | `NotificationsScreen.js` | Done | Grouped toggles, recent list |
| Subscriptions | `SubscriptionsScreen.js` | Done | Free / Premium / Pro plans |
| Help & Support | `HelpSupportScreen.js` | Done | Contact cards, FAQ, quick links |
| Select Symptom | `SelectSymptomScreen.js` | Done | Searchable symptom list |

### Services

| Service | File | Status | Notes |
|---------|------|--------|-------|
| Auth | `authService.js` | **Updated** | Reads `response.data.{access_token, refresh_token, user}` — matches new backend response shape; debug `console.log` statements present (cleanup needed) |
| Consult | `consultService.js` | Done | Falls back to mock data |
| Relief | `reliefService.js` | Done | Falls back to mock data |
| Wellness | `wellnessService.js` | Done | Falls back to mock data |
| Therapy | `therapyService.js` | Done | Falls back to mock data |

### Constants (`src/constants/apiEndpoints.js`) — Updated

| Constant | Value | Status |
|---------|-------|--------|
| `BASE_URL` | `http://10.0.2.2:5000` *(Android emulator)* | **Now set** |
| `HOME_QUICK_RELIEF` | `/api/v1/home/quick-relief` | **New** |
| `DOCTORS` | `/api/v1/doctors` | Done |
| `FACE_GLOW_ROUTINES` | `/api/v1/face-glow/routines` | **New** (no backend yet) |
| `FACE_GLOW_SCAN` | `/api/v1/face-glow/scan` | **New** (no backend yet) |
| `FACE_GLOW_SCAN_HISTORY` | `/api/v1/face-glow/history` | **New** (no backend yet) |

### Known Issues / Code Quality

| Issue | Location | Severity |
|-------|----------|---------|
| `STRINGS` imported but file doesn't exist | `HomeScreen.js:2` + `src/constants/strings.js` missing | High — will crash on import |
| Debug `console.log` statements | `authService.js:18–35` | Low — cleanup before release |
| `BottomNav.js` component unused | `src/components/BottomNav.js` | Low |
| Tokens in `AsyncStorage` instead of secure storage | `authService.js` | Medium — security gap |
| `logout()` only clears local storage; does not call server | `authService.js:51–55` | Medium — refresh token stays valid |
| Wellness rows in HomeScreen use hardcoded fallback only | `HomeScreen.js:20–24` | Medium — no API integration yet |

---

## 4. Scorecard

| Dimension | Score | Reason |
|-----------|-------|--------|
| Architecture | 8/10 | Clean layered backend; clear frontend service pattern |
| UI/UX | 8/10 | Polished screens, consistent color scheme |
| Authentication | 9/10 | JWT, refresh tokens, blocklist, RBAC |
| API Integration | 5/10 | 2 domain endpoints now live; 17+ still missing |
| Data Models | 7/10 | Doctor module fully modelled; no appointment/session models yet |
| Testing | 0/10 | Zero test files found |
| Documentation | 7/10 | READMEs solid; this audit tracks current state |
| Code Quality | 6/10 | Debug logs in authService; missing strings.js; monolithic screens |
| Completeness | 6/10 | Doctor listing works end-to-end; most features still stubbed |
| Production Readiness | 3/10 | Missing rate limiting, CORS, monitoring, tests, CI/CD |

---

## 5. Security Observations

### Good
- bcrypt password hashing
- JWT with expiration + revocation
- Role-based access control decorator
- Bearer token attached by interceptor

### Needs Attention
- `AsyncStorage` used for tokens (prefer `react-native-keychain` or `expo-secure-store`)
- `logout()` in `authService.js` does not call `POST /api/v1/auth/logout` — refresh token remains valid on server
- No CORS config on Flask backend
- No rate limiting on `/register` and `/login`
- Seed doctor passwords are plaintext `"123456"` — `User.__init__` does not hash them via the service layer (check if this goes through bcrypt)

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
@react-navigation/native-stack | @react-navigation/bottom-tabs
@react-native-async-storage/async-storage
react-native-vector-icons | react-native-video
```
