import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

// Trailing slash matches the FastAPI route ("/consent/") and avoids a 307.
const BASE = `${ENDPOINTS.CONSENT}/`;

const consentService = {
  /** Returns a map of { consent_type: granted(boolean) }. */
  async getConsents() {
    const res = await apiClient.get(BASE);
    const list = res?.data?.consents ?? [];
    const map = {};
    list.forEach(c => { map[c.consent_type] = !!c.granted; });
    return map;
  },

  /** Grant or update a consent. */
  async setConsent(consentType, granted) {
    const res = await apiClient.post(BASE, { consent_type: consentType, granted });
    return res.data;
  },

  /** Revoke a consent type. */
  async revokeConsent(consentType) {
    return apiClient.delete(`${ENDPOINTS.CONSENT}/${consentType}`);
  },
};

export default consentService;
