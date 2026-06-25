# Wellness Mobile App

A high-performance React Native mobile application for enterprise wellness and acupressure therapy.

## Tech Stack
- **Framework:** React Native (0.84+)
- **Language:** JavaScript / TypeScript
- **Navigation:** React Navigation (Stack & Bottom Tabs)
- **Icons:** Material Community Icons
- **Storage:** Async Storage
- **Media:** React Native Video

## Folder Structure
```text
mobile/
├── src/
│   ├── api/             # axios client (token injection, 401 auto-refresh)
│   ├── components/      # Reusable UI components (Toast, SkeletonLoader, cards)
│   ├── config/          # Env-driven config (EXPO_PUBLIC_API_URL)
│   ├── constants/       # API endpoints, strings, theme tokens
│   ├── navigation/      # navigationRef for imperative navigation
│   ├── screens/         # Main application screens (Home, Consult, etc.)
│   ├── services/        # API service layer (Business logic & data fetching)
│   ├── store/           # Zustand stores (auth)
│   ├── utils/           # Helpers (secureStorage, toast store)
│   └── __tests__/       # Jest service + screen smoke tests
├── App.tsx              # Main entry point and Navigation Root
├── index.js             # AppRegistry registration
└── package.json         # Dependencies and scripts
```

## Development Workflow

Follow this pattern when adding new features:

| Layer | Folder | Responsibility |
| :--- | :--- | :--- |
| **Screen** | `src/screens/` | Top-level UI components. Handle navigation params and lifecycle. |
| **Component** | `src/components/` | Small, reusable UI units (Buttons, Cards, Modals). No business logic. |
| **Service** | `src/services/` | Logic for API calls and data transformation. |
| **Interceptor** | `src/interceptors/` | Global handling for Auth headers, status codes, and error logging. |
| **Data** | `src/data/` | Static content, JSON mocks, and shared constants for UI text. |
| **Constants** | `src/constants/` | API routes and global configuration values. |

### How to Add a New Feature
1. **Define API:** Add new endpoints in `src/constants/apiEndpoints.js`.
2. **Create Service:** Add a method in the relevant service in `src/services/` to fetch data.
3. **Build Screen:** Create your screen in `src/screens/`. Use the service to fetch data on mount.
4. **Register Route:** Import and add the screen to the navigation stack in `App.tsx`.

## Setup & Installation

### 1. Configure Backend URL
Update the `BASE_URL` in `src/constants/apiEndpoints.js` to point to your running backend:
```javascript
export const BASE_URL = 'http://10.0.2.2:5000'; // For Android Emulator
// export const BASE_URL = 'http://localhost:5000'; // For iOS Simulator
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Native Setup
- **iOS:** 
  ```bash
  cd ios && pod install && cd ..
  ```
- **Android:** Ensure you have the Android SDK and Emulator configured.

## Running the Application

### Step 1: Start Metro Bundler
```bash
npm start
```

### Step 2: Launch App
- **Android:**
  ```bash
  npm run android
  ```
- **iOS:**
  ```bash
  npm run ios
  ```
