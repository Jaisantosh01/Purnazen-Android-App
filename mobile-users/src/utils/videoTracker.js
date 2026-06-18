import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

/**
 * Utility to sync video progress with backend.
 * Backend expects: groupId, videoId, status, durationMinutes.
 */
export const syncVideoProgress = async (
  groupId,
  videoId,
  status, // 'Pending' | 'Completed'
  durationMinutes,
  sessionType = 'wellness', // Accept session type
  painBefore = null,
  painAfter = null
) => {
  try {
    await apiClient.post(ENDPOINTS.SAVE_THERAPY_SESSION, {
      groupId,
      videoId,
      status,
      durationMinutes: Math.max(1, Math.round(durationMinutes)), // Min 1 min
      painBefore,
      painAfter,
      isActive: true,
      type: sessionType, // Use the provided session type
    });
  } catch (error) {
    console.error('Failed to sync video progress:', error);
  }
};
