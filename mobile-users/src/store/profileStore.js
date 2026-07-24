import { create } from 'zustand';

/**
 * One-time post-sign-up onboarding gates.
 *
 * `pendingCompletion` — show the "complete your profile" step (phone, gender,
 * date of birth). `pendingBiometricSetup` — offer to turn on fingerprint / Face
 * unlock (only set when the device actually supports biometrics). Both are set
 * right after a successful sign-up and cleared when the user finishes or skips
 * that step. In-memory only: they gate the current session after sign-up;
 * existing users logging in are not forced through either.
 */
export const useProfileStore = create(set => ({
  pendingCompletion: false,
  setPendingCompletion: pendingCompletion => set({ pendingCompletion }),

  pendingBiometricSetup: false,
  setPendingBiometricSetup: pendingBiometricSetup => set({ pendingBiometricSetup }),
}));
