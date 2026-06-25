import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

const appointmentService = {
  /** List all appointments for the logged-in doctor (with optional filters). */
  async getDoctorAppointments(params = {}) {
    const res = await apiClient.get(ENDPOINTS.APPOINTMENTS_DOCTOR, { params });
    return res?.data ?? { appointments: [], total: 0 };
  },

  /** List the logged-in doctor's appointments (legacy — kept for compat). */
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
