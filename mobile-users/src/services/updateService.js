/**
 * Store update check.
 *
 * The app is distributed through the app stores, so it never downloads or
 * installs code itself — Play and the App Store own the update pipeline. All
 * this does is ask the backend which version is current and, when the running
 * build is older, let the UI point the user at the store listing.
 *
 * `/app-releases/latest?app=<slug>` returns the published version plus a
 * `forced` flag; `forced` makes the banner non-dismissible (used when an old
 * build can no longer talk to the API).
 */
import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import {
  APP_SLUG,
  APP_VERSION,
  ANDROID_PACKAGE_NAME,
  IOS_APP_STORE_ID,
} from '../config';

// Release notes written before the backend grew a `forced` boolean embedded
// this marker in the notes text. Still stripped from anything we render so old
// rows don't leak it into the UI.
export const FORCE_MARKER = 'purnazen:force-update';

// Settings → Auto-update. Default ON. When OFF, optional update banners stay
// quiet until the user taps "Check for Updates"; forced releases still show.
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

/** Strip the legacy force marker out of release notes before rendering. */
export function cleanNotes(notes) {
  return String(notes || '')
    .split('\n')
    .filter(l => !l.includes(FORCE_MARKER))
    .join('\n')
    .trim();
}

/**
 * @param {{force?: boolean}} [opts] force=true runs the check even in dev (used
 *   by the manual "Check for Updates" button); the automatic launch check leaves
 *   it false so Metro/dev sessions aren't nagged.
 * @returns {Promise<null | {version, current, forced, notes}>}
 *   null when up to date, offline, or (unless forced) in dev.
 */
export async function checkForUpdate({ force = false } = {}) {
  if (!force && typeof __DEV__ !== 'undefined' && __DEV__) return null;
  try {
    const res = await apiClient.get(ENDPOINTS.APP_RELEASE_LATEST(APP_SLUG));
    const latest = res?.data; // { version, versionCode, forced, notes }
    if (!latest || !latest.version) return null;
    if (compareSemver(latest.version, APP_VERSION) <= 0) return null; // up to date

    return {
      version: latest.version,
      current: APP_VERSION,
      forced: !!latest.forced,
      notes: cleanNotes(latest.notes),
    };
  } catch {
    return null; // never block app start on a network/auth/parse error
  }
}

/**
 * Open this app's store listing. `market://` hands straight to the Play app;
 * when it isn't installed (or on iOS) fall back to the https listing, which the
 * store app also claims via an intent filter / universal link.
 */
export async function openStoreListing() {
  const [deepLink, webLink] =
    Platform.OS === 'ios'
      ? [
          `itms-apps://itunes.apple.com/app/id${IOS_APP_STORE_ID}`,
          `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`,
        ]
      : [
          `market://details?id=${ANDROID_PACKAGE_NAME}`,
          `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`,
        ];
  try {
    await Linking.openURL(deepLink);
  } catch {
    try {
      await Linking.openURL(webLink);
    } catch {}
  }
}
