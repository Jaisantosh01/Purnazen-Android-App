import preferencesService from '../../services/preferencesService';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

describe('PreferencesService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getPreferences', () => {
    it('returns user preferences from api', async () => {
      const prefs = {
        pushEnabled: true,
        notifications: { session_reminder: true, appointment: true, offers: false },
      };
      apiClient.get.mockResolvedValue({ success: true, data: prefs });

      const result = await preferencesService.getPreferences();

      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result).toEqual(prefs);
    });

    it('propagates api error', async () => {
      apiClient.get.mockRejectedValue(new Error('Not found'));

      await expect(preferencesService.getPreferences()).rejects.toThrow('Not found');
    });

    it('throws fallback message when error has no message', async () => {
      apiClient.get.mockRejectedValue({});

      await expect(preferencesService.getPreferences()).rejects.toThrow(
        'Failed to fetch preferences',
      );
    });
  });

  describe('updatePreferences', () => {
    it('sends push toggle and returns updated prefs', async () => {
      const updated = { pushEnabled: false, notifications: {} };
      apiClient.put.mockResolvedValue({ success: true, data: updated });

      const result = await preferencesService.updatePreferences({ pushEnabled: false });

      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining('preferences'),
        { pushEnabled: false, notifications: undefined },
      );
      expect(result).toEqual(updated);
    });

    it('sends notification toggle update', async () => {
      apiClient.put.mockResolvedValue({ success: true, data: {} });

      await preferencesService.updatePreferences({
        notifications: { session_reminder: false },
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        expect.any(String),
        { pushEnabled: undefined, notifications: { session_reminder: false } },
      );
    });

    it('propagates update error', async () => {
      apiClient.put.mockRejectedValue(new Error('Server error'));

      await expect(preferencesService.updatePreferences({})).rejects.toThrow('Server error');
    });
  });
});
