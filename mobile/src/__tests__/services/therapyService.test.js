import therapyService from '../../services/therapyService';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

describe('TherapyService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getTherapyHistory', () => {
    it('returns history data from api', async () => {
      const data = {
        stats: { sessions: 5, minutes: 120, avgRelief: 7 },
        sessions: [
          { id: 1, title: 'Yoga', status: 'Completed', date: '2026-06-10', duration: '15 min', painBefore: 8, painAfter: 4 },
        ],
      };
      apiClient.get.mockResolvedValue({ success: true, data });

      const result = await therapyService.getTherapyHistory();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(data);
    });

    it('propagates api error message', async () => {
      apiClient.get.mockRejectedValue(new Error('Unauthorized'));

      await expect(therapyService.getTherapyHistory()).rejects.toThrow('Unauthorized');
    });

    it('throws fallback message when error has no message', async () => {
      apiClient.get.mockRejectedValue({});

      await expect(therapyService.getTherapyHistory()).rejects.toThrow(
        'Failed to fetch therapy history',
      );
    });
  });

  describe('saveSession', () => {
    it('posts session data and returns saved record', async () => {
      const saved = { id: 42, title: 'Yoga', status: 'Completed' };
      apiClient.post.mockResolvedValue({ success: true, data: saved });

      const result = await therapyService.saveSession({ title: 'Yoga', duration: '15 min' });

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(result).toEqual(saved);
    });

    it('propagates save error', async () => {
      apiClient.post.mockRejectedValue(new Error('Validation error'));

      await expect(therapyService.saveSession({})).rejects.toThrow('Validation error');
    });
  });
});
