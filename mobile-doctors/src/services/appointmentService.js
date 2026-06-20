import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

/**
 * Appointment data for the doctor app. SKELETON: methods are wired to the
 * intended endpoints, but the doctor-scoped list endpoint may not exist on the
 * backend yet (see apiEndpoints.js TODO). Screens fall back to an empty state.
 */
const appointmentService = {
  /** List the logged-in doctor's appointments. */
  async list(params = {}) {
    const res = await apiClient.get(ENDPOINTS.APPOINTMENTS, { params });
    return res?.data ?? [];
  },

  /** Fetch a single appointment by id. */
  async detail(id) {
    const res = await apiClient.get(ENDPOINTS.APPOINTMENT_DETAIL(id));
    return res?.data ?? null;
  },

  /** Update an appointment's status (accept / complete / cancel). */
  async updateStatus(id, status) {
    const res = await apiClient.put(ENDPOINTS.APPOINTMENT_DETAIL(id), { status });
    return res?.data ?? null;
  },
};

export default appointmentService;
