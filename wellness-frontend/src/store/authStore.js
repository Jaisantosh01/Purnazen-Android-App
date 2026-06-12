import { create } from 'zustand';

/**
 * Global auth state. authService keeps this in sync with AsyncStorage:
 * login() -> setAuth(user), logout() -> clearAuth(), bootstrap -> setAuth(storedUser).
 */
export const useAuthStore = create(set => ({
  user: null,
  isLoggedIn: false,

  setAuth: user => set({ user, isLoggedIn: !!user }),
  clearAuth: () => set({ user: null, isLoggedIn: false }),
}));
