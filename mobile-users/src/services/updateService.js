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
 * build can no longer talk to the API). It also returns `storeLinks`, the
 * per-platform place "Update" should open — so a private channel (unlisted App
 * Store link, TestFlight public link) can change without a new build.
 *
 * On Android, builds installed from Google Play update in place through Play's
 * In-App Updates flow (native InAppUpdate module); everything else opens the
 * link.
 */
import { Linking, NativeModules, Platform } from 'react-native';
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

// Last `storeLinks` the backend sent ({ android?, ios? }).
let storeLinks = {};

const getInAppUpdate = () => (Platform.OS === 'android' ? NativeModules.InAppUpdate : null);

/**
 * Resume a Play update the user started but left (Play requires this on every
 * return to the foreground). Safe to call anywhere; resolves to the status.
 */
export async function resumeInterruptedUpdate() {
  const inAppUpdate = getInAppUpdate();
  if (!inAppUpdate?.resumeIfInProgress) return 'unsupported';
  try {
    return await inAppUpdate.resumeIfInProgress();
  } catch {
    return 'error';
  }
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
    // Replace, not merge: a link removed on the server stops being used.
    storeLinks =
      latest.storeLinks && typeof latest.storeLinks === 'object' ? latest.storeLinks : {};
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

/** Where "Update" leads on this platform: [deep link, web fallback]. */
export function storeTargets(links = storeLinks) {
  const configured = Platform.OS === 'ios' ? links?.ios : links?.android;
  if (configured) return [configured, null];
  return Platform.OS === 'ios'
    ? [
        IOS_APP_STORE_ID ? `itms-apps://itunes.apple.com/app/id${IOS_APP_STORE_ID}` : null,
        IOS_APP_STORE_ID ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}` : null,
      ]
    : [
        `market://details?id=${ANDROID_PACKAGE_NAME}`,
        `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`,
      ];
}

/**
 * Update the app. On a Play install this runs Play's in-app update; otherwise
 * it opens the configured link, falling back to the store listing. Resolves to
 * true when something was opened.
 */
export async function openStoreListing() {
  const inAppUpdate = getInAppUpdate();
  if (inAppUpdate?.startImmediate) {
    try {
      const status = await inAppUpdate.startImmediate();
      if (status === 'started' || status === 'cancelled') return true;
    } catch {}
  }
  const [deepLink, webLink] = storeTargets();
  for (const url of [deepLink, webLink]) {
    if (!url) continue;
    try {
      await Linking.openURL(url);
      return true;
    } catch {}
  }
  return false;
}
