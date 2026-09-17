import { create } from 'zustand';

/**
 * Pending two-step sign-in. The password (or social) step succeeded and the
 * server returned a short-lived `mfa_token`; App.tsx shows the code screen
 * while one is held. Memory only — never persisted.
 */
export const useMfaStore = create(set => ({
  challengeToken: null,
  setChallenge: token => set({ challengeToken: token }),
  clear: () => set({ challengeToken: null }),
}));
