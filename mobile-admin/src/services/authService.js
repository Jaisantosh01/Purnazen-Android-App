import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import secureStorage from '../utils/secureStorage';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { useAuthStore } from '../store/authStore';
import { APP_ROLE } from '../config';

// RBAC: shown when a valid credential belongs to a different app's role.
const ROLE_MISMATCH_MESSAGE =
  'This account does not have admin access. Please use the correct app.';

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
   * admins: the backend never creates an admin account from social login —
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

    // Tokens go to the device keystore; the user profile is not a secret
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

  /**
   * Re-read the profile from the server and cache it.
   *
   * Not just a nicety: `avatar_url` is a short-lived Azure SAS URL (~60 min),
   * so the copy persisted at login goes stale and the photo silently stops
   * loading. Called on app start — see App.tsx. Never throws; an offline start
   * simply keeps the cached profile.
   */
  async refreshProfile() {
    try {
      const response = await apiClient.get(ENDPOINTS.ME);
      const user = response?.data?.user;
      if (!user || user.role !== APP_ROLE) return null;
      return this._cacheUser(user);
    } catch {
      return null;
    }
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

  /** Create an account, then log straight in (returns the user). */
  async register(fullName, email, password) {
    const response = await apiClient.post(ENDPOINTS.REGISTER, {
      full_name: fullName,
      email,
      password,
    });

    if (!response.success) {
      throw new Error(response.message || 'Registration failed');
    }

    return this.login(email, password);
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

  /** Update the editable profile fields; keeps the cached user and store in sync. */
  async updateProfile({ fullName, avatarUrl, phone, gender, dateOfBirth } = {}) {
    const payload = {};
    if (fullName !== undefined) payload.fullName = fullName;
    if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl;
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
   * Change the password. The backend revokes every previously issued token
   * and returns a fresh pair, which replaces the stored ones.
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

  /** Delete the account server-side, then clear the local session. */
  async deleteAccount() {
    const response = await apiClient.delete(ENDPOINTS.ME);

    if (!response.success) {
      throw new Error(response.message || 'Account deletion failed');
    }

    await secureStorage.clearTokens();
    await AsyncStorage.removeItem('user');
    useAuthStore.getState().clearAuth();
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
    // Move tokens persisted by older builds out of plaintext AsyncStorage
    try {
      await secureStorage.migrateFromAsyncStorage();
    } catch (error) {
      // Keystore unavailable (e.g. emulator quirk) — user can log in again
    }

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
