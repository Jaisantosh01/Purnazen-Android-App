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
  user: null,
  isLoggedIn: false,

  setAuth: user => {
    setCrashUser(user?.id ?? null);
    set({ user, isLoggedIn: !!user });
  },
  clearAuth: () => {
    setCrashUser(null);
    set({ user: null, isLoggedIn: false });
  },
}));
