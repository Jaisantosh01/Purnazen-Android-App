import authService from '../../services/authService';
import apiClient from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from '../../utils/secureStorage';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../../utils/secureStorage', () => ({
  setTokens: jest.fn().mockResolvedValue(undefined),
  getAccessToken: jest.fn().mockResolvedValue('access-token'),
  getRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
  clearTokens: jest.fn().mockResolvedValue(undefined),
  migrateFromAsyncStorage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../navigation/navigationRef', () => ({
  resetToLogin: jest.fn(),
}));

const USER = { id: 1, email: 'test@example.com', full_name: 'Test User' };

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('login', () => {
    it('stores tokens and returns user on success', async () => {
      apiClient.post.mockResolvedValue({
        success: true,
        data: { access_token: 'acc', refresh_token: 'ref', user: USER },
      });

      const result = await authService.login('test@example.com', 'password123');

      expect(result).toEqual(USER);
      expect(secureStorage.setTokens).toHaveBeenCalledWith('acc', 'ref');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(USER));
    });

    it('throws when success is false', async () => {
      apiClient.post.mockResolvedValue({ success: false, message: 'Invalid credentials' });

      await expect(authService.login('bad@email.com', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('throws default message when server sends no message', async () => {
      apiClient.post.mockResolvedValue({ success: false });

      await expect(authService.login('a@b.com', 'pw')).rejects.toThrow('Login failed');
    });
  });

  describe('logout', () => {
    it('clears tokens and user from storage', async () => {
      apiClient.post.mockResolvedValue({ success: true });

      await authService.logout();

      expect(secureStorage.clearTokens).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
    });

    it('still clears local storage if revoke call fails', async () => {
      apiClient.post.mockRejectedValue(new Error('Network error'));

      await authService.logout();

      expect(secureStorage.clearTokens).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('updateProfile', () => {
    it('updates user and returns new profile', async () => {
      const updated = { ...USER, full_name: 'New Name' };
      apiClient.put.mockResolvedValue({ success: true, data: { user: updated } });

      const result = await authService.updateProfile({ fullName: 'New Name' });

      expect(result).toEqual(updated);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(updated));
    });

    it('throws when update fails', async () => {
      apiClient.put.mockResolvedValue({ success: false, message: 'Validation error' });

      await expect(authService.updateProfile({ fullName: '' })).rejects.toThrow(
        'Validation error',
      );
    });
  });

  describe('isLoggedIn', () => {
    it('returns true when access token exists', async () => {
      secureStorage.getAccessToken.mockResolvedValue('some-token');
      expect(await authService.isLoggedIn()).toBe(true);
    });

    it('returns false when no access token', async () => {
      secureStorage.getAccessToken.mockResolvedValue(null);
      expect(await authService.isLoggedIn()).toBe(false);
    });
  });
});
