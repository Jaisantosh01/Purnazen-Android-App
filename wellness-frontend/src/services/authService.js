import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { useAuthStore } from '../store/authStore';

class AuthService {

  async login(email, password) {
    const response = await apiClient.post(ENDPOINTS.LOGIN, {
      email,
      password,
    });

    if (!response.success) {
      throw new Error(response.message || 'Login failed');
    }

    const { access_token, refresh_token, user } = response.data;

    await AsyncStorage.multiSet([
      ['access_token', access_token],
      ['refresh_token', refresh_token],
      ['user', JSON.stringify(user)],
    ]);

    useAuthStore.getState().setAuth(user);

    return user;
  }

  async logout() {
    // Revoke the refresh token server-side; clear locally even if that fails
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      if (refreshToken) {
        await apiClient.post(ENDPOINTS.LOGOUT, null, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
      }
    } catch (error) {
      // Token may already be expired/revoked — local logout still proceeds
    }

    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    useAuthStore.getState().clearAuth();
  }

  getToken() {
    return AsyncStorage.getItem('access_token');
  }

  async getUser() {
    const user = await AsyncStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  async isLoggedIn() {
    const token = await this.getToken();
    return !!token;
  }

  /** Restore persisted session into the Zustand store on app start. */
  async bootstrap() {
    const user = await this.getUser();
    if (user) {
      useAuthStore.getState().setAuth(user);
    }
    return user;
  }

}

export default new AuthService();
