import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import secureStorage from '../utils/secureStorage';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { useAuthStore } from '../store/authStore';
import { APP_ROLE } from '../config';

// RBAC: shown when a valid credential belongs to a different app's role.
const ROLE_MISMATCH_MESSAGE =
  'This account is not registered as a doctor. Please use the correct app.';

/**
 * Auth for the doctor app. Doctors authenticate against the same backend as
 * patients (there is no self-register flow here — doctor accounts are
 * provisioned server-side). Surface mirrors the patient app's authService so
 * shared call sites port over.
 */
class AuthService {
  async login(email, password) {
    const response = await apiClient.post(ENDPOINTS.LOGIN, {
      email,
      password,
      expected_role: APP_ROLE,
    });

    if (!response.success) {
      throw new Error(response.message || 'Login failed');
    }

    const { access_token, refresh_token, user } = response.data;

    // RBAC: this app only serves APP_ROLE accounts. Reject a wrong-role login
    // client-side too (covers an older backend without the role gate) and never
    // persist its tokens.
    if (!user || user.role !== APP_ROLE) {
      throw new Error(ROLE_MISMATCH_MESSAGE);
    }

    // Tokens go to the device keystore; the profile is not a secret
    await secureStorage.setTokens(access_token, refresh_token);
    await AsyncStorage.setItem('user', JSON.stringify(user));

    useAuthStore.getState().setAuth(user);
    return user;
  }

  async logout() {
    // Revoke the refresh token server-side; clear locally even if that fails
    try {
      const refreshToken = await secureStorage.getRefreshToken();
      if (refreshToken) {
        await apiClient.post(ENDPOINTS.LOGOUT, null, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
      }
    } catch (error) {
      // Token may already be expired/revoked — local logout still proceeds
    }

    await secureStorage.clearTokens();
    await AsyncStorage.removeItem('user');
    useAuthStore.getState().clearAuth();
  }

  /** Update profile (full name / phone); keeps the cached user and store in sync. */
  async updateProfile({ fullName, phone } = {}) {
    const payload = {};
    if (fullName !== undefined) payload.fullName = fullName;
    if (phone !== undefined) payload.phone = phone;
    const response = await apiClient.put(ENDPOINTS.ME, payload);

    if (!response.success) {
      throw new Error(response.message || 'Profile update failed');
    }

    const user = response.data.user;
    await AsyncStorage.setItem('user', JSON.stringify(user));
    useAuthStore.getState().setAuth(user);
    return user;
  }

  /**
   * Change the password. The backend revokes every previously issued token and
   * returns a fresh pair, which replaces the stored ones.
   */
  async changePassword(currentPassword, newPassword) {
    const response = await apiClient.post(ENDPOINTS.CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    });

    if (!response.success) {
      throw new Error(response.message || 'Password change failed');
    }

    const { access_token, refresh_token } = response.data;
    await secureStorage.setTokens(access_token, refresh_token);
  }

  getToken() {
    return secureStorage.getAccessToken();
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
    // RBAC: only restore a session that belongs to this app's role. A stale or
    // cross-app session is cleared so it can't slip past the login gate.
    if (user && user.role === APP_ROLE) {
      useAuthStore.getState().setAuth(user);
      return user;
    }
    if (user) {
      await secureStorage.clearTokens();
      await AsyncStorage.removeItem('user');
    }
    return null;
  }
}

export default new AuthService();
