import { create } from 'zustand';

/**
 * Global auth state. authService keeps this in sync with persisted storage
 * (tokens in keychain, user JSON in AsyncStorage):
 * login() -> setAuth(user), logout() -> clearAuth(), bootstrap -> setAuth(storedUser).
 */
export const useAuthStore = create(set => ({
  doctor: null,
  isLoggedIn: false,

  setAuth: doctor => set({ doctor, isLoggedIn: !!doctor }),
  clearAuth: () => set({ doctor: null, isLoggedIn: false }),
}));
