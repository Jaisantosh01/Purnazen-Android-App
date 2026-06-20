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
   * The backend merges the notifications dict with stored values.
   */
  async updatePreferences({ pushEnabled, notifications } = {}) {
    try {
      const json = await apiClient.put(ENDPOINTS.PREFERENCES, {
        pushEnabled,
        notifications,
      });
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to update preferences');
    }
  }

}

export default new PreferencesService();
