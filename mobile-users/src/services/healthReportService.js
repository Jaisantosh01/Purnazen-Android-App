import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

class HealthReportService {
  /**
   * Consolidated read-only health summary: profile vitals, medical background,
   * therapy totals, appointment history and the latest face/tongue scan.
   */
  async getReport() {
    try {
      const json = await apiClient.get(ENDPOINTS.HEALTH_REPORT);
      return json?.data;
    } catch (err) {
      throw new Error(err?.message ?? 'Failed to load your health report');
    }
  }
}

export default new HealthReportService();
