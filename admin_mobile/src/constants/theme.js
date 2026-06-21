/**
 * Canonical design tokens. New code should use these instead of hex literals;
 * existing screens are being migrated incrementally (see docs/TASKS.md —
 * "Shared theme adoption").
 *
 * Counts from the 2026-06 audit: #1FA77A appears 120x, #1A1A1A 72x, etc.
 */
export const COLORS = {
  // Brand
  primary: '#EA580C',       // Main orange
  primaryLight: '#FFF7ED',  // Light orange background
  primaryFaint: '#FFFBF5',  // Very soft orange tint

  accent: '#9A3412',        // Deep burnt orange
  accentLight: '#FEE2E2',

  warning: '#EAB308',       // Yellow (changed from orange)
  danger: '#DC2626',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Surfaces
  white: '#FFFFFF',
  black: '#000000',
  background: '#FFFDF9',    // Warm off-white
  surfaceMuted: '#F9FAFB',
  border: '#FED7AA',        // Soft orange border
  borderStrong: '#FDBA74',
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
