import { Platform } from 'react-native';

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
 */
const RAW_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * Android emulators cannot reach the host via `localhost` (that resolves to the
 * emulator's own loopback); the host is exposed at 10.0.2.2. Rewrite a localhost
 * dev URL on Android so the emulator hits the dev backend instead of failing
 * with a "Network Error". iOS simulators share the host network; production
 * builds inject a real URL, which is left untouched.
 */
function resolveBaseUrl(url) {
  if (Platform.OS === 'android') {
    return url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i, '$110.0.2.2');
  }
  return url;
}

export const BASE_URL = resolveBaseUrl(RAW_BASE_URL);

export const API_VERSION = '/api/v1';

// ── Live-update (OTA) config ─────────────────────────────────────────────────
// APP_SLUG matches the release tag prefix `<slug>-v<version>` used by the
// "Release Mobile Apps" workflow. APP_VERSION is the running marketing version,
// injected at build time (EXPO_PUBLIC_APP_VERSION) to match the gradle versionName.
export const APP_SLUG = 'mobile-admin';
export const APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION || '0.0.0';
export const GITHUB_REPO = 'Jaisantosh01/Purnazen-Android-App';
