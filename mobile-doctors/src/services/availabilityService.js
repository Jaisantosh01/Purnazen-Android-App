import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

/**
 * Doctor availability / schedule management. Backed by the backend's
 * doctor_availability endpoints (GET/POST/PUT/DELETE /doctor-availability).
 */
const availabilityService = {
  async list() {
    const res = await apiClient.get(ENDPOINTS.AVAILABILITY);
    const data = res?.data ?? [];
    return data.map(item => ({
      id: item.availability_id,
      doctor_id: item.doctor_id,
      slot_timing_id: item.slot_timing_id,
      is_active: item.is_active,
      day: item.day,
      day_of_week_id: item.day_of_week_id,
      start_time: item.start_time,
      end_time: item.end_time,
    }));
  },

  async create(slot) {
    // slot: { doctor_id, slot_timing_id }
    const res = await apiClient.post(ENDPOINTS.AVAILABILITY, slot);
    return res?.data ?? null;
  },

  async update(id, slot) {
    const res = await apiClient.put(ENDPOINTS.AVAILABILITY_ITEM(id), slot);
    return res?.data ?? null;
  },

  async remove(id) {
    const res = await apiClient.delete(ENDPOINTS.AVAILABILITY_ITEM(id));
    return res?.success ?? false;
  },

  async getSlots() {
    const res = await apiClient.get(ENDPOINTS.SLOT_TIMINGS);
    return res?.data ?? [];
  },

  async getDoctors() {
    const res = await apiClient.get(ENDPOINTS.DOCTORS, { params: { limit: 100 } });
    return res?.data?.doctors ?? [];
  },
};

export default availabilityService;
