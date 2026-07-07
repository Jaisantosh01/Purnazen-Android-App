import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

class NotificationsService {

  /** Returns { notifications: [...], total, unreadCount }. */
  async list({ unreadOnly = false, limit = 50, offset = 0 } = {}) {
    const params = `?unreadOnly=${unreadOnly}&limit=${limit}&offset=${offset}`;
    const json = await apiClient.get(`${ENDPOINTS.NOTIFICATIONS}${params}`);
    return json?.data ?? { notifications: [], total: 0, unreadCount: 0 };
  }

  /** Lightweight unread-count poll for badges. */
  async unreadCount() {
    try {
      const data = await this.list({ unreadOnly: true, limit: 1 });
      return data.unreadCount ?? 0;
    } catch {
      return 0;
    }
  }

  async markRead(id) {
    const json = await apiClient.patch(ENDPOINTS.NOTIFICATION_READ(id), {});
    return json?.data;
  }

  async markAllRead() {
    const json = await apiClient.post(ENDPOINTS.NOTIFICATIONS_READ_ALL, {});
    return json?.data;
  }

  async remove(id) {
    return apiClient.delete(`${ENDPOINTS.NOTIFICATIONS}/${id}`);
  }

  /** Register this device's FCM token (called by pushService after login). */
  async registerDeviceToken(token, { platform = 'android', app = 'users' } = {}) {
    return apiClient.post(ENDPOINTS.DEVICE_TOKENS, { token, platform, app });
  }

  /** Unregister on logout so the next user doesn't get our pushes. */
  async removeDeviceToken(token) {
    return apiClient.post(ENDPOINTS.DEVICE_TOKENS_REMOVE, { token });
  }
}

export default new NotificationsService();
