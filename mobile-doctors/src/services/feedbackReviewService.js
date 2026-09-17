/**
 * Patient session feedback, for staff review.
 *
 * Backend: GET /therapy-feedback/doctor/review and
 * PUT /therapy-feedback/{id}/doctor-feedback.
 */
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

export const REVIEWER = 'doctor';
export const PAGE_SIZE = 20;

const feedbackReviewService = {
  /**
   * @param {{status?: 'all'|'pending'|'reviewed', patientId?: string, offset?: number}} opts
   * @returns {Promise<{items: object[], total: number, offset: number}>}
   */
  async list({ status = 'pending', patientId, offset = 0 } = {}) {
    const params = { status, limit: PAGE_SIZE, offset };
    if (patientId) params.patientId = patientId;
    const res = await apiClient.get(ENDPOINTS.FEEDBACK_REVIEW, { params });
    if (!res?.success) throw new Error(res?.message || 'Could not load feedback');
    return res.data;
  },

  async reply(feedbackId, text) {
    const body = { doctorFeedback: text };
    const res = await apiClient.put(ENDPOINTS.FEEDBACK_REPLY(feedbackId), body);
    if (!res?.success) throw new Error(res?.message || 'Could not save the reply');
    return res.data;
  },
};

export default feedbackReviewService;
