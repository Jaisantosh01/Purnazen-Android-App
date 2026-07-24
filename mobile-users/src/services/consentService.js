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
    // The API serialises each record as `consentType` (camelCase). Accept the
    // snake_case form too so the map is keyed correctly either way — without
    // this the keys came out `undefined` and every toggle read as OFF.
    list.forEach(c => {
      const type = c.consentType ?? c.consent_type;
      if (type) map[type] = !!c.granted;
    });
    return map;
  },

  /** Convenience: has the user granted a specific consent type? */
  async hasConsent(consentType) {
    const map = await this.getConsents();
    return !!map[consentType];
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
