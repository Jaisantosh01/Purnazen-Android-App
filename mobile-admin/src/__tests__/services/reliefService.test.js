import reliefService from '../../services/reliefService';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

describe('ReliefService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getAllReliefSessions', () => {
    it('returns relief sessions from api', async () => {
      const sessions = [
        { id: 1, title: 'Neck Pain', slug: 'neck-pain' },
        { id: 2, title: 'Back Pain', slug: 'back-pain' },
      ];
      apiClient.get.mockResolvedValue({ success: true, data: { sessions } });

      const result = await reliefService.getAllReliefSessions();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ sessions });
    });

    it('propagates api error message', async () => {
      apiClient.get.mockRejectedValue(new Error('Server error'));

      await expect(reliefService.getAllReliefSessions()).rejects.toThrow('Server error');
    });

    it('throws fallback message when error has no message', async () => {
      apiClient.get.mockRejectedValue({});

      await expect(reliefService.getAllReliefSessions()).rejects.toThrow(
        'Failed to fetch relief sessions',
      );
    });
  });

  describe('getReliefSession', () => {
    it('returns single relief session', async () => {
      const session = { id: 1, title: 'Neck Pain', steps: [] };
      apiClient.get.mockResolvedValue({ success: true, data: session });

      const result = await reliefService.getReliefSession('neck-pain');

      expect(result).toEqual(session);
    });

    it('propagates error on fetch failure', async () => {
      apiClient.get.mockRejectedValue(new Error('Not found'));

      await expect(reliefService.getReliefSession('unknown')).rejects.toThrow('Not found');
    });
  });
});
