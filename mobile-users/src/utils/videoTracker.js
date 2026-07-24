import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';

export const syncVideoProgress = async (
  groupId,
  videoId,
  status,
  durationMinutes,
  sessionType = 'wellness',
  painBefore = null,
  painAfter = null,
  sessionGroupId = null
) => {
  try {
    const body = {
      groupId,
      videoId,
      status,
      durationMinutes: Math.max(1, Math.round(durationMinutes)),
      painBefore,
      painAfter,
      isActive: true,
      type: sessionType,
    };
    if (sessionGroupId) body.sessionGroupId = sessionGroupId;
    await apiClient.post(ENDPOINTS.SAVE_THERAPY_SESSION, body);
  } catch (error) {
    console.error('Failed to sync video progress:', error);
  }
};
