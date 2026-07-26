import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import preferencesService from './preferencesService';

/**
 * Runtime permission helper.
 *
 *   mandatory: camera (face/tongue scans are a core feature)
 *   optional:  location (address autofill), notifications (reminders)
 *
 * On Android we use PermissionsAndroid; on iOS these are requested at the point
 * of use by their respective libraries, so the methods resolve as "granted"
 * there. The one-time onboarding result is persisted to AsyncStorage so we only
 * prompt once.
 *
 * ── Location ─────────────────────────────────────────────────────────────────
 * Location has two switches and they have to agree:
 *
 *   1. the OS grant (Android App info → Permissions), device-local, and
 *   2. `locationEnabled` in server preferences, the in-app choice, which syncs
 *      across devices.
 *
 * The app may use location only when *both* say yes, so every read goes through
 * `locationStatus()` and every write through `enableLocation()` /
 * `disableLocation()`. Previously the Settings toggle rendered the stored
 * preference alone: granting or revoking the permission in Android's App info
 * left the toggle showing the opposite of reality, and the direct
 * `PermissionsAndroid.request` in the address screen changed the OS grant
 * without ever telling the preference.
 */

const PROMPTED_KEY = 'permissions_prompted_v1';

export const MANDATORY = ['camera'];
export const OPTIONAL = ['location', 'notifications'];

const ANDROID_PERMISSION = {
  camera: PermissionsAndroid.PERMISSIONS.CAMERA,
  location: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  // POST_NOTIFICATIONS only exists on Android 13+ (and newer RN); undefined
  // elsewhere, where notifications don't need a runtime grant.
  notifications: PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
};

async function check(name) {
  if (Platform.OS !== 'android') return true;
  const perm = ANDROID_PERMISSION[name];
  if (!perm) return true; // not applicable on this OS version → effectively granted
  try {
    return await PermissionsAndroid.check(perm);
  } catch {
    return false;
  }
}

async function request(name) {
  if (Platform.OS !== 'android') return 'granted';
  const perm = ANDROID_PERMISSION[name];
  if (!perm) return 'granted';
  try {
    return await PermissionsAndroid.request(perm);
  } catch {
    return 'denied';
  }
}

const permissionsService = {
  check,
  request,

  /** Current grant booleans for all tracked permissions. */
  async status() {
    const [camera, location, notifications] = await Promise.all([
      check('camera'),
      check('location'),
      check('notifications'),
    ]);
    return { camera, location, notifications };
  },

  /**
   * Request mandatory first, then optional. Returns a map of
   * { camera, location, notifications } → boolean granted, and records that we
   * have now prompted so this never runs twice.
   *
   * The "prompted" write used `AsyncStorage.multiSet`, which v3 removed (it is
   * `setMany` now, taking an object). That threw *after* the OS dialogs had been
   * shown, so the flag was never stored — the prompts reappeared on every launch
   * and, worse, the caller's `locationEnabled` mirror never ran, which is why a
   * granted location permission left Settings → Location Access switched off.
   */
  async requestAll() {
    const result = {};
    for (const name of [...MANDATORY, ...OPTIONAL]) {
      // eslint-disable-next-line no-await-in-loop
      result[name] = (await request(name)) === 'granted';
    }
    await AsyncStorage.setItem(PROMPTED_KEY, '1');
    return result;
  },

  async hasPrompted() {
    return (await AsyncStorage.getItem(PROMPTED_KEY)) != null;
  },

  /** Run the one-time onboarding request the first time after login. */
  async ensureRequested() {
    if (await this.hasPrompted()) return null;
    return this.requestAll();
  },

  /** Re-request a single optional permission (e.g. from the Settings toggle). */
  async enable(name) {
    return (await request(name)) === 'granted';
  },

  // ── Location: OS grant ⨯ stored preference ─────────────────────────────────

  /**
   * Reconciled location state:
   *   granted   — the OS permission is held right now
   *   enabled   — the user's stored in-app preference
   *   effective — both, i.e. may the app actually use location
   *
   * Reconciling matters: revoking the permission from Android's App info can't
   * notify us, so a stored `true` is corrected back to `false` here rather than
   * left to render an on-looking toggle over a permission we don't have.
   */
  async locationStatus() {
    const granted = await check('location');
    let enabled = false;
    try {
      const prefs = await preferencesService.getPreferences();
      enabled = prefs?.locationEnabled === true;
    } catch {
      // Offline / server hiccup — fall back to the device truth alone.
      return { granted, enabled: granted, effective: granted };
    }

    if (!granted && enabled) {
      enabled = false;
      preferencesService.updatePreferences({ locationEnabled: false }).catch(() => {});
    }
    return { granted, enabled, effective: granted && enabled };
  },

  /**
   * Turn location access on. Requests the OS permission when we don't hold it
   * and stores the preference either way.
   *
   * Returns { granted, blocked } — `blocked` is Android's "don't ask again",
   * where the only route left is the app's system settings page.
   */
  async enableLocation() {
    let granted = await check('location');
    let blocked = false;
    if (!granted) {
      const result = await request('location');
      granted = result === 'granted';
      blocked = result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    }
    await preferencesService
      .updatePreferences({ locationEnabled: granted })
      .catch(() => {});
    return { granted, blocked };
  },

  /**
   * Turn location access off in-app. The OS grant itself can only be revoked
   * from device settings, so this is what actually stops the app using it.
   */
  async disableLocation() {
    await preferencesService
      .updatePreferences({ locationEnabled: false })
      .catch(() => {});
  },

  /**
   * Gate for a feature that needs a position right now (address autofill).
   * Treats the tap as consent: if access is off it asks for it and, on success,
   * flips the stored preference on so the Settings toggle agrees.
   */
  async ensureLocation() {
    const { effective } = await this.locationStatus();
    if (effective) return { granted: true, blocked: false };
    return this.enableLocation();
  },
};

export default permissionsService;
