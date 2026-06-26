import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Theme preference store.
 *
 *   mode: 'system' | 'light' | 'dark'
 *
 * The chosen mode is persisted to AsyncStorage so it survives restarts.
 * Resolving `mode` + the OS color scheme into an actual palette happens in
 * the useTheme() hook (src/hooks/useTheme.js) so it can react to live OS
 * appearance changes.
 */
const STORAGE_KEY = 'theme_mode';

export const useThemeStore = create(set => ({
  mode: 'system',
  hydrated: false,

  setMode: mode => {
    set({ mode });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  },

  // Called once on app bootstrap.
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ mode: stored });
      }
    } catch {
      // Fall back to the in-memory default ('system').
    } finally {
      set({ hydrated: true });
    }
  },
}));
