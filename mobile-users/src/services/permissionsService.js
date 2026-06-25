import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Runtime permission helper.
 *
 *   mandatory: camera (face/tongue scans are a core feature)
 *   optional:  location (nearby-doctor search), notifications (reminders)
 *
 * On Android we use PermissionsAndroid; on iOS these are requested at the point
 * of use by their respective libraries, so the methods resolve as "granted"
 * there. The one-time onboarding result is persisted to AsyncStorage so we only
 * prompt once, and the location grant is mirrored into server preferences by the
 * caller (so it syncs across devices).
 */

const PROMPTED_KEY = 'permissions_prompted_v1';
const RESULT_KEY = 'permissions_result_v1';

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
   * { camera, location, notifications } → boolean granted. Persists the result.
   */
  async requestAll() {
    const result = {};
    for (const name of [...MANDATORY, ...OPTIONAL]) {
      // eslint-disable-next-line no-await-in-loop
      result[name] = (await request(name)) === 'granted';
    }
    await AsyncStorage.multiSet([
      [PROMPTED_KEY, '1'],
      [RESULT_KEY, JSON.stringify(result)],
    ]);
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
};

export default permissionsService;
