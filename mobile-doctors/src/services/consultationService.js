import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

/**
 * Clinical records for an appointment (doctor notes / diagnosis / prescription),
 * backed by /appointments/:id/records. `recordType` is one of
 * 'doctor_note' | 'diagnosis' | 'prescription'.
 */
const consultationService = {
  /** All records for an appointment (newest-last). */
  async list(appointmentId) {
    const res = await apiClient.get(ENDPOINTS.CONSULTATION_RECORDS(appointmentId));
    return res?.data ?? [];
  },

  async create(appointmentId, recordType, content) {
    const res = await apiClient.post(ENDPOINTS.CONSULTATION_RECORDS(appointmentId), {
      recordType,
      content,
    });
    return res?.data ?? null;
  },

  async update(appointmentId, recordId, content) {
    const res = await apiClient.put(ENDPOINTS.CONSULTATION_RECORD(appointmentId, recordId), {
      content,
    });
    return res?.data ?? null;
  },

  async remove(appointmentId, recordId) {
    await apiClient.delete(ENDPOINTS.CONSULTATION_RECORD(appointmentId, recordId));
  },
};

export default consultationService;
