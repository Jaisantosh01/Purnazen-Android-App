import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

class PreferencesService {

  /** Returns { pushEnabled, notifications: { toggleId: bool } }. */
  async getPreferences() {
    try {
      const json = await apiClient.get(ENDPOINTS.PREFERENCES);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch preferences');
    }
  }

  /**
   * Partial update — pass only what changed:
   *   updatePreferences({ pushEnabled: false })
   *   updatePreferences({ notifications: { appointment: true } })
   *   updatePreferences({ language: 'hi' })
   * The backend merges the notifications dict and only applies the keys present.
   */
  async updatePreferences({ pushEnabled, notifications, language } = {}) {
    const payload = {};
    if (pushEnabled !== undefined) payload.pushEnabled = pushEnabled;
    if (notifications !== undefined) payload.notifications = notifications;
    if (language !== undefined) payload.language = language;
    try {
      const json = await apiClient.put(ENDPOINTS.PREFERENCES, payload);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to update preferences');
    }
  }

}

export default new PreferencesService();
