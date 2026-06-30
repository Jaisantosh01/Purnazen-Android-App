import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

class SupportService {

  /** Help & Support contacts + FAQs (admin-configurable, served from the DB). */
  async getHelp() {
    try {
      const json = await apiClient.get(ENDPOINTS.SUPPORT_HELP);
      const data = json?.data || {};
      return {
        contacts: data.contacts || [],
        faqs: data.faqs || [],
      };
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to load help content');
    }
  }

}

export default new SupportService();
