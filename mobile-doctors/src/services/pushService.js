/**
 * Device push registration (Firebase Cloud Messaging).
 *
 * Works only once android/app/google-services.json exists (see
 * docs/NOTIFICATIONS.md). Until then every call fails softly and the app runs
 * with in-app notifications only. Closed-app delivery needs no JS: the backend
 * sends a `notification` payload which Android displays in the system tray.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import notificationsService from './notificationsService';

class PushService {
  token = null;
  unsubscribeRefresh = null;

  /** Call after login. Returns true when push is active. */
  async init() {
    try {
      const { getApp } = require('@react-native-firebase/app');
      const m = require('@react-native-firebase/messaging');
      const messaging = m.getMessaging(getApp());

      // Android 13+ needs the runtime POST_NOTIFICATIONS permission
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      }
      await m.requestPermission(messaging);

      this.token = await m.getToken(messaging);
      if (!this.token) return false;
      await notificationsService.registerDeviceToken(this.token);

      if (this.unsubscribeRefresh) this.unsubscribeRefresh();
      this.unsubscribeRefresh = m.onTokenRefresh(messaging, async newToken => {
        this.token = newToken;
        try {
          await notificationsService.registerDeviceToken(newToken);
        } catch {}
      });
      return true;
    } catch (err) {
      // Missing google-services.json / Play Services — in-app feed still works
      console.log('[push] device push unavailable:', err?.message);
      return false;
    }
  }

  /** Call on logout so the next user on this device doesn't get our pushes. */
  async unregister() {
    try {
      if (this.unsubscribeRefresh) {
        this.unsubscribeRefresh();
        this.unsubscribeRefresh = null;
      }
      if (this.token) {
        await notificationsService.removeDeviceToken(this.token);
        this.token = null;
      }
    } catch {}
  }
}

export default new PushService();
