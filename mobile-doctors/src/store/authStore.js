import { create } from 'zustand';
import { setCrashUser } from '../services/crashReporting';

/**
 * Global auth state. authService keeps this in sync with persisted storage
 * (tokens in keychain, user JSON in AsyncStorage):
 * login() -> setAuth(user), logout() -> clearAuth(), bootstrap -> setAuth(storedUser).
 *
 * Crashlytics gets the account id from here rather than from each call site:
 * login, logout and bootstrap all funnel through these two setters, so this is
 * the one place it cannot be forgotten. The id only — never the email or name.
 */
export const useAuthStore = create(set => ({
  doctor: null,
  isLoggedIn: false,

  setAuth: doctor => {
    setCrashUser(doctor?.id ?? null);
    set({ doctor, isLoggedIn: !!doctor });
  },
  clearAuth: () => {
    setCrashUser(null);
    set({ doctor: null, isLoggedIn: false });
  },
}));
