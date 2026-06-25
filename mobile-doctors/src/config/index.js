/**
 * Build-time configuration.
 *
 * The backend base URL is provided at build time via the EXPO_PUBLIC_API_URL
 * env var (Expo inlines EXPO_PUBLIC_* at bundle time). It is intentionally NOT
 * hardcoded in source, so the repo never pins or exposes a specific backend
 * environment:
 *   - CI release builds inject it from a GitHub repo variable (API_BASE_URL).
 *   - Local release builds pass it to scripts/build-apks.sh.
 *   - Dev uses a git-ignored .env (e.g. http://localhost:5000, or your LAN IP).
 * The only in-source fallback is localhost for dev — never a real backend URL.
 * The doctor app talks to the SAME FastAPI backend as the patient app.
 *
 * The configured URL is used verbatim — we deliberately do NOT rewrite
 * `localhost` to the emulator alias 10.0.2.2. That alias only exists inside an
 * Android emulator; on a physical USB device it is unreachable and every request
 * fails with a "Network Error", and from JS we can't tell an emulator from a real
 * device. Instead, the recommended dev setup is `localhost:5000` +
 * `adb reverse tcp:5000 tcp:5000`, which forwards the device/emulator's loopback
 * to the host and works for BOTH. (Emulator without adb reverse: set 10.0.2.2 in
 * .env; physical device over Wi-Fi: set your machine's LAN IP.)
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export const API_VERSION = '/api/v1';

// ── Live-update (OTA) config ─────────────────────────────────────────────────
// APP_SLUG matches the release tag prefix `<slug>-v<version>` used by the
// "Release Mobile Apps" workflow. APP_VERSION is the running marketing version,
// injected at build time (EXPO_PUBLIC_APP_VERSION) to match the gradle versionName.
export const APP_SLUG = 'mobile-doctors';
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || '0.0.0';
export const GITHUB_REPO = 'Jaisantosh01/Purnazen-Android-App';

// ── RBAC ─────────────────────────────────────────────────────────────────────
// The single backend role this app serves. Login is gated to this role both
// client-side (authService) and server-side (login `expected_role`).
export const APP_ROLE = 'doctor';
