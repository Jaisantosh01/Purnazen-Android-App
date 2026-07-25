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

    return this._persistSession(response.data);
  }

  /**
   * Sign in with a Firebase Auth ID token (Google/GitHub). Sign-in only for
   * doctors: the backend never creates a doctor account from social login —
   * the identity must match an existing account's email or a linked account.
   */
  async socialLogin(firebaseIdToken) {
    const response = await apiClient.post(ENDPOINTS.SOCIAL_LOGIN, {
      id_token: firebaseIdToken,
      expected_role: APP_ROLE,
    });

    if (!response.success) {
      throw new Error(response.message || 'Sign-in failed');
    }

    return this._persistSession(response.data);
  }

  /** Shared post-login step: RBAC check, then persist tokens + profile. */
  async _persistSession({ access_token, refresh_token, user }) {
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

  /** Cache an updated profile locally + in the store. */
  async _cacheUser(user) {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    useAuthStore.getState().setAuth(user);
    return user;
  }

  /** Bind a Firebase-verified social identity to the logged-in account. */
  async linkSocial(firebaseIdToken) {
    const response = await apiClient.post(ENDPOINTS.SOCIAL_LINK, {
      id_token: firebaseIdToken,
    });
    if (!response.success) {
      throw new Error(response.message || 'Could not link the account');
    }
    return this._cacheUser(response.data.user);
  }

  /** Remove the linked social identity. */
  async unlinkSocial() {
    const response = await apiClient.post(ENDPOINTS.SOCIAL_UNLINK);
    if (!response.success) {
      throw new Error(response.message || 'Could not unlink the account');
    }
    return this._cacheUser(response.data.user);
  }

  /** Change the login email (password confirmation for password accounts). */
  async changeEmail(newEmail, currentPassword) {
    const response = await apiClient.post(ENDPOINTS.CHANGE_EMAIL, {
      newEmail,
      currentPassword: currentPassword || undefined,
    });
    if (!response.success) {
      throw new Error(response.message || 'Could not update email');
    }
    return this._cacheUser(response.data.user);
  }

  async logout() {
    // Unregister the push token while the access token is still valid — the
    // App.tsx auth-flip effect fires too late (tokens already cleared → 401).
    try {
      await require('./pushService').default.unregister();
    } catch {}

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
  async updateProfile({ fullName, phone, gender, dateOfBirth } = {}) {
    const payload = {};
    if (fullName !== undefined) payload.fullName = fullName;
    if (phone !== undefined) payload.phone = phone;
    if (gender !== undefined) payload.gender = gender;
    if (dateOfBirth !== undefined) payload.dateOfBirth = dateOfBirth;
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
