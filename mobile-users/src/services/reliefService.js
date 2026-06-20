import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

class ReliefService {

  get(endpoint) {
    return apiClient.get(endpoint);
  }

  async getAllReliefSessions() {
    try {
      const json = await this.get(ENDPOINTS.ALL_RELIEF_SESSIONS);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch relief sessions');
    }
  }

  async getReliefSession(sessionKey) {
    try {
      const json = await this.get(ENDPOINTS.RELIEF_SESSION(sessionKey));
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch relief session');
    }
  }

}

export default new ReliefService();
