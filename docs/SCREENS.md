# Purnazen — Screen Inventory

All 20 screens in the React Native app (`mobile-users/src/screens/`). Each row notes the
current data source, loading state, and what was polished.

---

## Auth Stack

| # | Screen | File | Purpose |
|---|--------|------|---------|
| 1 | Login | [LoginScreen.js](../mobile-users/src/screens/LoginScreen.js) | Email/password sign-in |
| 2 | Register | [RegisterScreen.js](../mobile-users/src/screens/RegisterScreen.js) | New account creation |

---

## Home Stack

| # | Screen | File | Purpose | Data Source | Loading State |
|---|--------|------|---------|-------------|---------------|
| 3 | Home | [HomeScreen.js](../mobile-users/src/screens/HomeScreen.js) | Dashboard — quick relief cards + wellness teaser + consult CTA | `GET /v1/home/quick-relief`, `GET /v1/sessions` | Skeleton (QuickCardSkeleton × 4, WellnessRowSkeleton × 3) |
| 4 | Select Symptom | [SelectSymptomScreen.js](../mobile-users/src/screens/SelectSymptomScreen.js) | Curated symptom list → navigates to relief sessions | Static curated list (intentional — maps to session slugs) | Rendered immediately (no async load needed) |
| 5 | Face Glow | [FaceGlowScreen.js](../mobile-users/src/screens/FaceGlowScreen.js) | Face acupressure routines | `GET /v1/face-glow/routines` | RoutineCardSkeleton × 3 |
| 6 | Session Screen | [YogaSessionScreen.js](../mobile-users/src/screens/YogaSessionScreen.js) | Guided wellness/yoga session player | `GET /v1/sessions/{key}` | SessionPlayerSkeleton |
| 7 | Relief Session | [ReliefSessionScreen.js](../mobile-users/src/screens/ReliefSessionScreen.js) | Guided acupressure relief player | `GET /v1/relief-sessions/{key}` | SessionPlayerSkeleton |

---

## Relief Stack

| # | Screen | File | Purpose | Data Source | Loading State |
|---|--------|------|---------|-------------|---------------|
| 8 | Relief | [ReliefScreen.js](../mobile-users/src/screens/ReliefScreen.js) | Grid of acupressure sessions | `GET /v1/relief-sessions` | CardSkeleton (ListSkeleton) |

---

## Wellness Stack

| # | Screen | File | Purpose | Data Source | Loading State |
|---|--------|------|---------|-------------|---------------|
| 9 | Wellness | [WellnessScreen.js](../mobile-users/src/screens/WellnessScreen.js) | Yoga/meditation/breathing catalog | `GET /v1/sessions` | ProgramSkeleton × 3 + StatsSkeleton |

---

## Consult Stack

| # | Screen | File | Purpose | Data Source | Loading State |
|---|--------|------|---------|-------------|---------------|
| 10 | Consult | [ConsultScreen.js](../mobile-users/src/screens/ConsultScreen.js) | Doctor search + filter tabs | `GET /v1/filter-tabs`, `GET /v1/doctors` | ListSkeleton |
| 11 | Doctor Profile | [DoctorProfileScreen.js](../mobile-users/src/screens/DoctorProfileScreen.js) | Doctor detail + reviews | `GET /v1/doctors/{id}` | CardSkeleton |
| 12 | Book Appointment | [BookAppointmentScreen.js](../mobile-users/src/screens/BookAppointmentScreen.js) | Calendar + time slots + visit type | `GET /v1/doctors/{id}/visit-types`, `GET /v1/doctors/{id}/time-slots` | ActivityIndicator (slots) |
| 13 | Booking Confirmed | [BookingConfirmedScreen.js](../mobile-users/src/screens/BookingConfirmedScreen.js) | Success confirmation | Route params (no extra fetch) | — |
| 14 | Payment | [PaymentScreen.js](../mobile-users/src/screens/PaymentScreen.js) | Payment method selection + processing | `POST /v1/payments/process` | ActivityIndicator (pay button) |

---

## Profile Stack

| # | Screen | File | Purpose | Data Source | Loading State |
|---|--------|------|---------|-------------|---------------|
| 15 | Profile | [ProfileScreen.js](../mobile-users/src/screens/ProfileScreen.js) | User profile, stats, menu | `useAuthStore` (name/email) + `GET /v1/therapy-history` (stats) | StatsSkeleton while stats load |
| 16 | Therapy History | [TherapyHistoryScreen.js](../mobile-users/src/screens/TherapyHistoryScreen.js) | Past session list + aggregate stats | `GET /v1/therapy-history` | ActivityIndicator (proper empty state) |
| 17 | Subscriptions | [SubscriptionsScreen.js](../mobile-users/src/screens/SubscriptionsScreen.js) | Plan selector | Static plan catalog (business config); `currentPlan` from `useAuthStore` | — |
| 18 | Notifications | [NotificationsScreen.js](../mobile-users/src/screens/NotificationsScreen.js) | Notification preference toggles | Preference structure static; state from `GET /v1/users/me/preferences` | Empty state when no recent activity |
| 19 | Settings | [SettingsScreen.js](../mobile-users/src/screens/SettingsScreen.js) | App preferences, password change | `useAuthStore`, `POST /v1/auth/change-password` | — |
| 20 | Help & Support | [HelpSupportScreen.js](../mobile-users/src/screens/HelpSupportScreen.js) | FAQ accordion + contact options | Static (business copy — intentional) | — |

---

## Mock-Data Audit

### Intentionally Static (no backend needed)
- **SelectSymptomScreen** — Curated 8-item list, maps symptom → relief session slug. Not a DB resource.
- **HelpSupportScreen** — Business FAQ copy and contact links. Not dynamic.
- **SubscriptionsScreen** — Plan catalog is business configuration, not DB rows.
- **NotificationsScreen** — Preference *structure* (toggle IDs, labels) is static; values come from API.
- **PaymentScreen** — Payment method list (Card/UPI/Wallet) and wallet names are static UI config.

### Removed Fake Fallback Data
| Screen | What Was Removed | Replaced With |
|--------|-----------------|---------------|
| HomeScreen | `FALLBACK_WELLNESS` shown when API fails | Skeleton → empty section (no fake sessions) |
| NotificationsScreen | `RECENT_NOTIFICATIONS` (4 fake items) | "No recent activity" empty state |
| ProfileScreen | Hardcoded name `Jaisantosh`, email, stats `24/7days/180` | `useAuthStore` user + real stats from `/v1/therapy-history` |

### Wired Up (was hardcoded, now calls backend)
| Screen | Endpoint |
|--------|---------|
| FaceGlowScreen | `GET /v1/face-glow/routines` |
| ProfileScreen stats | `GET /v1/therapy-history` |
| SubscriptionsScreen current plan | `useAuthStore().user.plan` |

---

## Navigation Map

```
RootStack (auth-gated)
├── Login
├── Register
└── Tab Navigator
    ├── HomeTab
    │   └── Home → SelectSymptom → [ReliefSession | SessionScreen]
    │              FaceGlow
    ├── ReliefTab
    │   └── Relief → ReliefSession
    ├── WellnessTab
    │   └── Wellness → SessionScreen
    ├── ConsultTab
    │   └── Consult → DoctorProfile → BookAppointment → BookingConfirmed → Payment
    └── ProfileTab
        └── Profile → TherapyHistory
                       Subscriptions
                       Notifications
                       Settings
                       HelpSupport
```
