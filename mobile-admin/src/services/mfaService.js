/**
 * Two-step verification (authenticator app codes).
 * Backend: /auth/mfa/{setup,enable,disable,recovery-codes,verify}.
 */
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

const unwrap = (res, fallback) => {
  if (!res?.success) throw new Error(res?.message || fallback);
  return res.data;
};

/** "ABCDEFGHIJKL…" -> "ABCD EFGH IJKL …" for reading off the screen. */
export const groupSecret = secret => (secret || '').replace(/(.{4})/g, '$1 ').trim();

/** Digits only for 6-digit codes; recovery codes keep letters and dashes. */
export const normaliseCode = raw => {
  const s = String(raw || '').trim();
  return /^[\d\s]+$/.test(s) ? s.replace(/\s+/g, '') : s.toLowerCase();
};

const mfaService = {
  async setup() {
    return unwrap(await apiClient.post(ENDPOINTS.MFA_SETUP), 'Could not start setup');
  },
  async enable(code) {
    return unwrap(await apiClient.post(ENDPOINTS.MFA_ENABLE, { code: normaliseCode(code) }), 'Could not turn it on');
  },
  async disable(code) {
    return unwrap(await apiClient.post(ENDPOINTS.MFA_DISABLE, { code: normaliseCode(code) }), 'Could not turn it off');
  },
  async newRecoveryCodes(code) {
    return unwrap(await apiClient.post(ENDPOINTS.MFA_RECOVERY_CODES, { code: normaliseCode(code) }), 'Could not create new codes');
  },
  async verify(mfaToken, code) {
    return unwrap(
      await apiClient.post(ENDPOINTS.MFA_VERIFY, { mfa_token: mfaToken, code: normaliseCode(code) }),
      'That code did not work',
    );
  },
};

export default mfaService;
