import httpInterceptor from '../interceptors/httpInterceptor';
import { ENDPOINTS } from '../constants/apiEndpoints';

class WellnessService {

  get(endpoint) {
    return httpInterceptor.get(endpoint);
  }

  async getAllSessions() {
    try {
      const json = await this.get(ENDPOINTS.ALL_SESSIONS);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch sessions');
    }
  }

  async getSession(sessionKey) {
    try {
      const json = await this.get(ENDPOINTS.SESSION(sessionKey));
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch session');
    }
  }

}

export default new WellnessService();
