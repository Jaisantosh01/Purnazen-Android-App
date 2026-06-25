import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

class WellnessService {

  get(endpoint) {
    return apiClient.get(endpoint);
  }

  async getAllSessions() {
    try {
      const json = await this.get(ENDPOINTS.ALL_SESSIONS);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch sessions');
    }
  }

  /** Fetch a single wellness session catalog entry by its key. */
  async getSession(key) {
    try {
      const json = await this.get(ENDPOINTS.SESSION(key));
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch session');
    }
  }

}

export default new WellnessService();
