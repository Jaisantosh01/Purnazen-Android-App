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
   *   updatePreferences({ notifications: { offers: true } })
   *   updatePreferences({ language: 'hi' })
   *   updatePreferences({ address: '12 MG Road, Pune' })
   *   updatePreferences({ locationEnabled: true })
   * The backend merges the notifications dict and only applies the keys present.
   */
  async updatePreferences({ pushEnabled, notifications, language, address, locationEnabled } = {}) {
    const payload = {};
    if (pushEnabled !== undefined) payload.pushEnabled = pushEnabled;
    if (notifications !== undefined) payload.notifications = notifications;
    if (language !== undefined) payload.language = language;
    if (address !== undefined) payload.address = address;
    if (locationEnabled !== undefined) payload.locationEnabled = locationEnabled;
    try {
      const json = await apiClient.put(ENDPOINTS.PREFERENCES, payload);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to update preferences');
    }
  }

}

export default new PreferencesService();
