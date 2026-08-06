/**
 * Live-update (OTA) check — backend-brokered.
 *
 * The signed APKs live in a PRIVATE Azure blob container; the backend exposes
 * the latest version per app and mints a short-lived read-only SAS download URL.
 * The app polls `/app-releases/latest?app=<slug>` (JWT auto-attached by the api
 * client) and, when a newer version exists, fetches a SAS URL from
 * `/app-releases/<slug>/<version>/download`. Nothing is ever public and the repo
 * stays private. A release flagged `forced` makes the prompt non-dismissible
 * (see UpdatePrompt).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { APP_SLUG, APP_VERSION } from '../config';

// Kept for backwards-compat with call sites (Settings) that imported it; the
// backend now returns a `forced` boolean directly, so it's only a sentinel.
export const FORCE_MARKER = 'purnazen:force-update';

// Settings → Auto-update. Default ON. When OFF, optional updates stay quiet
// until the user taps "Check for Updates"; forced releases still interrupt.
const AUTO_UPDATE_KEY = 'pz_auto_update';

export async function getAutoUpdateEnabled() {
  try {
    const v = await AsyncStorage.getItem(AUTO_UPDATE_KEY);
    return v !== '0'; // missing → on
  } catch {
    return true;
  }
}

export async function setAutoUpdateEnabled(enabled) {
  try {
    await AsyncStorage.setItem(AUTO_UPDATE_KEY, enabled ? '1' : '0');
  } catch {}
}

// Compare dotted versions numerically: compareSemver('1.2.10','1.2.9') === 1.
export function compareSemver(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * @param {{force?: boolean}} [opts] force=true runs the check even in dev (used
 *   by the manual "Check for Updates" button); the automatic launch check leaves
 *   it false so Metro/dev sessions aren't nagged.
 * @returns {Promise<null | {version, current, forced, notes, sha256, apkUrl, pageUrl}>}
 *   null when up to date, offline, unauthenticated, or (unless forced) in dev.
 */
export async function checkForUpdate({ force = false } = {}) {
  if (!force && typeof __DEV__ !== 'undefined' && __DEV__) return null;
  try {
    const res = await apiClient.get(ENDPOINTS.APP_RELEASE_LATEST(APP_SLUG));
    const latest = res?.data; // { version, versionCode, forced, notes, sha256 }
    if (!latest || !latest.version) return null;
    if (compareSemver(latest.version, APP_VERSION) <= 0) return null; // up to date

    // Mint the short-lived SAS only when there's actually an update to offer.
    let apkUrl = null;
    try {
      const dl = await apiClient.get(
        ENDPOINTS.APP_RELEASE_DOWNLOAD(APP_SLUG, latest.version),
      );
      apkUrl = dl?.data?.url || null;
    } catch {
      // Surface the update even if the download URL fetch fails; the user can
      // retry from Settings.
    }

    return {
      version: latest.version,
      current: APP_VERSION,
      forced: !!latest.forced,
      notes: latest.notes || '',
      sha256: latest.sha256 || null,
      apkUrl,
      pageUrl: apkUrl,
    };
  } catch {
    return null; // never block app start on a network/auth/parse error
  }
}
