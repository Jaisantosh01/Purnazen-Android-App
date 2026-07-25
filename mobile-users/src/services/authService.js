import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import secureStorage from '../utils/secureStorage';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { useAuthStore } from '../store/authStore';
import { APP_ROLE } from '../config';

// RBAC: shown when a valid credential belongs to a different app's role.
const ROLE_MISMATCH_MESSAGE =
  'This account is not a Purnazen patient account. Please use the correct app.';

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
   * Sign in with a Firebase Auth ID token (any provider — Google, GitHub...).
   * The backend verifies it against the Firebase project and creates a
   * patient account on first login.
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

  /**
   * Update profile fields; keeps the cached user and store in sync. Only the
   * keys provided are sent, so partial updates (e.g. just the phone) are fine.
   */
  async updateProfile({
    fullName, avatarUrl, phone, gender, dateOfBirth,
    bloodGroup, heightCm, weightKg, allergies, conditions, medications,
  } = {}) {
    const payload = {};
    if (fullName !== undefined) payload.fullName = fullName;
    if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl;
    if (phone !== undefined) payload.phone = phone;
    if (gender !== undefined) payload.gender = gender;
    if (dateOfBirth !== undefined) payload.dateOfBirth = dateOfBirth;
    if (bloodGroup !== undefined) payload.bloodGroup = bloodGroup;
    if (heightCm !== undefined) payload.heightCm = heightCm;
    if (weightKg !== undefined) payload.weightKg = weightKg;
    if (allergies !== undefined) payload.allergies = allergies;
    if (conditions !== undefined) payload.conditions = conditions;
    if (medications !== undefined) payload.medications = medications;

    const response = await apiClient.put(ENDPOINTS.ME, payload);

    if (!response.success) {
      throw new Error(response.message || 'Profile update failed');
    }

    const user = response.data.user;
    await AsyncStorage.setItem('user', JSON.stringify(user));
    useAuthStore.getState().setAuth(user);
    return user;
  }

  /** Upload a profile photo (multipart) and sync the returned user. */
  async uploadAvatar(filePath) {
    const fileName = filePath.split('/').pop() || 'avatar.jpg';
    const ext = fileName.split('.').pop()?.toLowerCase();
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const form = new FormData();
    form.append('file', { uri: filePath, name: fileName, type });

    const response = await apiClient.post(ENDPOINTS.AVATAR_UPLOAD, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000,
    });

    if (!response.success) {
      throw new Error(response.message || 'Could not upload the photo');
    }
    return this._cacheUser(response.data.user);
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

  /**
   * Change the login email. Password accounts must confirm the current
   * password; social-created accounts may pass null.
   */
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

  /**
   * Ask an admin to delete the account. Patients can't remove their own record
   * (the clinical history has to be retained until the clinic signs it off), so
   * this only files the request — the session stays live.
   */
  async requestAccountDeletion() {
    const response = await apiClient.post(ENDPOINTS.ACCOUNT_DELETION_REQUEST);

    if (!response.success) {
      throw new Error(response.message || 'Could not submit your request');
    }
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
