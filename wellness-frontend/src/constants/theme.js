/**
 * Canonical design tokens. New code should use these instead of hex literals;
 * existing screens are being migrated incrementally (see docs/TASKS.md —
 * "Shared theme adoption").
 *
 * Counts from the 2026-06 audit: #1FA77A appears 120x, #1A1A1A 72x, etc.
 */
export const COLORS = {
  // Brand
  primary: '#1FA77A',
  primaryLight: '#E8F8F2',
  primaryFaint: '#F0FAF6',
  accent: '#7C3AED',
  accentLight: '#F3EEFF',
  warning: '#F59E0B',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Surfaces
  white: '#FFFFFF',
  black: '#000000',
  background: '#F5F5F5',
  surfaceMuted: '#F3F4F6',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};
