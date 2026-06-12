import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

class TherapyService {

  get(endpoint) {
    return apiClient.get(endpoint);
  }

  post(endpoint, body) {
    return apiClient.post(endpoint, body);
  }

  async getTherapyHistory() {
    try {
      const json = await this.get(ENDPOINTS.THERAPY_HISTORY);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch therapy history');
    }
  }

  async saveSession(sessionData) {
    try {
      const json = await this.post(ENDPOINTS.SAVE_THERAPY_SESSION, sessionData);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to save session');
    }
  }

}

export default new TherapyService();
