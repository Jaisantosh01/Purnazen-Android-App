import { create } from 'zustand';

/**
 * Profile-completion gate.
 *
 * Set right after a successful sign-up so the app shows the one-time
 * "complete your profile" step (phone, gender, date of birth) before the main
 * tabs. Cleared when the user saves or skips. In-memory only — it gates the
 * current session after sign-up; existing users logging in are not forced.
 */
export const useProfileStore = create(set => ({
  pendingCompletion: false,
  setPendingCompletion: pendingCompletion => set({ pendingCompletion }),
}));
