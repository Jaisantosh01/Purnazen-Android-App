import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { useAuthStore } from '../store/authStore';

// Helper to clean up doctor name comparison (matching ScheduleScreen.js helper)
const cleanName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(dr\b\.?|dr\b)\s*/gi, '')
    .trim();
};

const leaveService = {
  // Cache of the resolved doctor_id to avoid redundant fetches
  _doctorId: null,

  async getDoctorId() {
    if (this._doctorId) return this._doctorId;

    const currentUser = useAuthStore.getState().doctor;
    if (!currentUser) return null;

    // Fetch doctors to find the matched profile
    const res = await apiClient.get(ENDPOINTS.DOCTORS, { params: { limit: 100 } });
    const doctors = res?.data?.doctors ?? [];

    const matchedDoctor = doctors.find((d) => {
      const cleanD = cleanName(d.name);
      const cleanUser = cleanName(currentUser.full_name || currentUser.name);
      return cleanD === cleanUser || d.name.toLowerCase().includes(cleanUser);
    });

    if (matchedDoctor) {
      this._doctorId = matchedDoctor.id;
      return this._doctorId;
    }

    return null;
  },

  async list() {
    const res = await apiClient.get(ENDPOINTS.LEAVE_HISTORY);
    // Backend wraps response as: { success, message, data: { leaves: [...], total: N } }
    // apiClient already unwraps response.data, so res IS the body.
    // We must extract the nested leaves array.
    const leaves = res?.data?.leaves ?? res?.data ?? [];
    return Array.isArray(leaves) ? leaves : [];
  },

  async get(id) {
    const res = await apiClient.get(ENDPOINTS.LEAVE_ITEM(id));
    return res?.data ?? null;
  },

  async create(data) {
    // Inject the resolved doctor_id
    const doctorId = await this.getDoctorId();
    if (!doctorId) {
      throw new Error('Doctor profile not found. Cannot submit leave.');
    }

    const payload = {
      doctor_id: doctorId,
      leave_type: data.leaveType,
      start_date: data.startDate,
      end_date: data.endDate,
      reason: data.reason,
      notes: data.notes,
    };

    if (data.leaveType === 'single') {
      payload.start_time = data.startTime;
      payload.end_time = data.endTime;
    } else if (data.leaveType === 'custom') {
      payload.slot_timing_ids = data.slotTimingIds;
    }

    const res = await apiClient.post(ENDPOINTS.LEAVE_REQUEST, payload);
    // Backend returns: { success, message, data: { leave: {...} } }
    const leave = res?.data?.leave ?? res?.data ?? null;
    return leave;
  },

  async cancel(id) {
    // Cancel = soft-delete via DELETE /{id}
    const res = await apiClient.delete(ENDPOINTS.LEAVE_CANCEL(id));
    return res?.data ?? null;
  },
};

export default leaveService;
