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

  async scanHistory(id, scanType = 'face') {
    const res = await apiClient.get(`${ENDPOINTS.PATIENT_DETAIL(id)}/face-glow/history`, {
      params: { scan_type: scanType }
    });
    return res?.data ?? [];
  },

  async scanReport(patientId, scanId) {
    const res = await apiClient.get(`${ENDPOINTS.PATIENT_DETAIL(patientId)}/scan/${scanId}/report`);
    return res?.data ?? null;
  },

  async consultations(id) {
    const res = await apiClient.get(`${ENDPOINTS.PATIENT_DETAIL(id)}/consultations`);
    return res?.data ?? [];
  },

  async prescriptions(id) {
    const res = await apiClient.get(`${ENDPOINTS.PATIENT_DETAIL(id)}/prescriptions`);
    return res?.data ?? [];
  },
};

export default patientService;
