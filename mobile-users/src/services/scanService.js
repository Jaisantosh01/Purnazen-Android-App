import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

// Poll fast so the live mesh / per-feature checklist animates smoothly.
const POLL_INTERVAL_MS = 800;
const POLL_TIMEOUT_MS  = 60000;

const scanService = {
  /**
   * Run a quality check on a captured frame without creating a scan.
   * Returns { ok, issues: [{code, guidance, blocking}], metrics }.
   * @param {string} filePath  Local file URI (takeSnapshot result)
   * @param {'face'|'tongue'} scanType
   */
  async qualityPreview(filePath, scanType = 'face') {
    const fileName = filePath.split('/').pop() || 'preview.jpg';
    const form = new FormData();
    form.append('file', { uri: filePath, name: fileName, type: 'image/jpeg' });
    const res = await apiClient.post(
      `${ENDPOINTS.FACE_GLOW_QUALITY_PREVIEW}?scan_type=${scanType}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 8000 },
    );
    return res.data;
  },

  /**
   * Upload a scan image. Returns { scan_id, status, estimated_seconds }.
   * @param {string} filePath  Local file URI
   * @param {'face'|'tongue'} scanType
   */
  async uploadScan(filePath, scanType = 'face') {
    const fileName = filePath.split('/').pop() || 'scan.jpg';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const form = new FormData();
    form.append('file', { uri: filePath, name: fileName, type: mimeType });

    const res = await apiClient.post(
      `${ENDPOINTS.FACE_GLOW_SCAN_UPLOAD}?scan_type=${scanType}`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Image uploads need longer than the default 15s on mobile networks.
        timeout: 45000,
      },
    );
    // apiClient already unwraps axios response.data → {success, message, data}
    return res.data;
  },

  /**
   * Fetch current status for a scan. Returns the status payload.
   */
  async getScanStatus(scanId) {
    const res = await apiClient.get(ENDPOINTS.FACE_GLOW_SCAN_STATUS(scanId));
    return res.data;
  },

  /**
   * Poll until completed/failed or timeout. Returns final status payload.
   * Calls onStatus(payload) on each poll tick.
   */
  async pollScanStatus(scanId, { onStatus } = {}) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const payload = await scanService.getScanStatus(scanId);
      onStatus?.(payload);
      if (payload.status === 'completed' || payload.status === 'failed') {
        return payload;
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error('Scan timed out after 60 seconds');
  },

  /**
   * Fetch paginated scan history.
   */
  async getHistory({ scanType = 'all', page = 1, limit = 20 } = {}) {
    const res = await apiClient.get(ENDPOINTS.FACE_GLOW_SCAN_HISTORY, {
      params: { scan_type: scanType, page, limit },
    });
    return res.data;
  },

  /**
   * Delete a scan and its Cloudinary images.
   */
  async deleteScan(scanId) {
    return apiClient.delete(ENDPOINTS.FACE_GLOW_SCAN_DELETE(scanId));
  },

  /**
   * Dashboard: face → latest result + rolling glow + glow trend;
   * tongue → latest markers + rolling wellness + wellness trend.
   */
  async getDashboard({ scanType = 'face' } = {}) {
    const res = await apiClient.get(ENDPOINTS.FACE_GLOW_DASHBOARD, {
      params: { scan_type: scanType },
    });
    return res.data;
  },

  /** Time series for a single metric (e.g. 'glow_score' / 'overall_wellness_score'). */
  async getTrends({ metric = 'glow_score', days = 0, scanType = 'face' } = {}) {
    const res = await apiClient.get(ENDPOINTS.FACE_GLOW_TRENDS, {
      params: { metric, days, scan_type: scanType },
    });
    return res.data;
  },

  /** Compare a scan to a baseline (defaults to the previous scan). */
  async compareScan(scanId, compareToId = null) {
    const res = await apiClient.post(
      ENDPOINTS.FACE_GLOW_SCAN_COMPARE(scanId),
      compareToId ? { compare_to_id: compareToId } : {},
    );
    return res.data;
  },
};

export default scanService;
