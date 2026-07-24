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

  async startSession(groupId, sessionType) {
    try {
      const json = await this.post(ENDPOINTS.START_THERAPY_SESSION, {
        groupId,
        sessionType,
      });
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to start session');
    }
  }

  async getIncompleteSession(groupId) {
    try {
      const json = await this.get(ENDPOINTS.THERAPY_INCOMPLETE_SESSION(groupId));
      return json?.data;
    } catch {
      return null;
    }
  }

  async getSessionGroups(page = 1, limit = 20, groupId = null) {
    try {
      const params = { page, limit };
      if (groupId) params.groupId = groupId;
      const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
      const json = await this.get(`${ENDPOINTS.THERAPY_SESSIONS_LIST}?${qs}`);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to fetch sessions');
    }
  }

  async completeSession(sessionGroupId, painAfter = null, userFeedback = null) {
    try {
      const json = await this.post(ENDPOINTS.COMPLETE_THERAPY_SESSION(sessionGroupId), {
        painAfter,
        userFeedback,
      });
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to complete session');
    }
  }

}

export default new TherapyService();
