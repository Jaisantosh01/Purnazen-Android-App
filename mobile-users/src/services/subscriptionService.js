import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

/**
 * Subscription plans catalog + the current user's plan.
 *
 * The API envelope is { success, message, data }, so `apiClient.get` resolves
 * to the body and the payload lives under `.data`.
 */
const subscriptionService = {
  /** Active plans (catalog), ordered for display. */
  async getPlans() {
    const res = await apiClient.get(ENDPOINTS.SUBSCRIPTION_PLANS);
    return res?.data?.plans ?? [];
  },

  /** The user's current subscription (defaults to the free plan server-side). */
  async getCurrent() {
    const res = await apiClient.get(ENDPOINTS.SUBSCRIPTION_ME);
    return res?.data?.subscription ?? null;
  },

  /** Switch the user to `planCode`; returns the updated subscription. */
  async subscribe(planCode) {
    const res = await apiClient.post(ENDPOINTS.SUBSCRIPTION_SUBSCRIBE, { plan_code: planCode });
    return res?.data?.subscription ?? null;
  },
};

export default subscriptionService;
