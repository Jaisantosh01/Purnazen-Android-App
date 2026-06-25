import wellnessService from '../../services/wellnessService';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

describe('WellnessService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getAllSessions', () => {
    it('returns sessions data from api', async () => {
      const sessions = [
        { key: 'YogaSession', title: 'Yoga', duration: '15 min' },
        { key: 'MeditationSession', title: 'Meditation', duration: '10 min' },
      ];
      apiClient.get.mockResolvedValue({ success: true, data: { sessions } });

      const result = await wellnessService.getAllSessions();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ sessions });
    });

    it('propagates api error message', async () => {
      apiClient.get.mockRejectedValue(new Error('Network timeout'));

      await expect(wellnessService.getAllSessions()).rejects.toThrow('Network timeout');
    });

    it('throws fallback message when error has no message', async () => {
      apiClient.get.mockRejectedValue({});

      await expect(wellnessService.getAllSessions()).rejects.toThrow(
        'Failed to fetch sessions',
      );
    });
  });

  describe('getSession', () => {
    it('returns single session data', async () => {
      const session = { key: 'YogaSession', title: 'Yoga', videoUrl: 'https://...' };
      apiClient.get.mockResolvedValue({ success: true, data: session });

      const result = await wellnessService.getSession('YogaSession');

      expect(result).toEqual(session);
    });

    it('propagates api error', async () => {
      apiClient.get.mockRejectedValue(new Error('Not found'));

      await expect(wellnessService.getSession('BadKey')).rejects.toThrow('Not found');
    });
  });
});
