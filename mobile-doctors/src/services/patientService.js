import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

/**
 * Patient data for the doctor app. SKELETON: a doctor-scoped patients endpoint
 * is a likely backend follow-up (see apiEndpoints.js TODO). Screens fall back
 * to an empty state until those endpoints exist.
 */
const patientService = {
  async list(params = {}) {
    const res = await apiClient.get(ENDPOINTS.PATIENTS, { params });
    return res?.data ?? [];
  },

  async detail(id) {
    const res = await apiClient.get(ENDPOINTS.PATIENT_DETAIL(id));
    return res?.data ?? null;
  },

  /** A patient's face-scan history (reuses the user-scoped face-glow history). */
  async scanHistory(id) {
    const res = await apiClient.get(ENDPOINTS.PATIENT_SCANS(id));
    return res?.data ?? [];
  },
};

export default patientService;
