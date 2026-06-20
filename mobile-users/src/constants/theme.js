/**
 * Canonical design tokens. New code should use these instead of hex literals;
 * existing screens are being migrated incrementally (see docs/TASKS.md —
 * "Shared theme adoption").
 *
 * Counts from the 2026-06 audit: #1FA77A appears 120x, #1A1A1A 72x, etc.
 *
 * Dark mode: prefer the `useTheme()` hook (src/hooks/useTheme.js) which returns
 * the active palette. The static `COLORS` export below is the LIGHT palette and
 * stays the default for screens not yet migrated to the hook.
 */

// Brand hues are shared across light/dark — only surfaces/text flip.
const BRAND = {
  primary: '#1FA77A',
  accent: '#7C3AED',
  warning: '#F59E0B',
  danger: '#EF4444',
  white: '#FFFFFF',
  black: '#000000',
};

export const LIGHT_COLORS = {
  ...BRAND,

  primaryLight: '#E8F8F2',
  primaryFaint: '#F0FAF6',
  accentLight: '#F3EEFF',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Surfaces
  background: '#F5F5F5',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F4F6',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  // Header card — keeps the brand-green hero on both schemes
  headerBg: '#1FA77A',
  headerText: '#FFFFFF',
  statusBar: 'light-content',
};

export const DARK_COLORS = {
  ...BRAND,

  // A slightly desaturated primary reads better on dark surfaces
  primary: '#27B98A',
  primaryLight: '#13332A',
  primaryFaint: '#10241E',
  accent: '#A78BFA',
  accentLight: '#241B3A',

  // Text
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A7B0',
  textMuted: '#6B7280',

  // Surfaces
  background: '#0F1413',
  card: '#1A201E',
  surface: '#1A201E',
  surfaceMuted: '#232a28',
  border: '#2C3431',
  borderStrong: '#3A433F',

  headerBg: '#14302A',
  headerText: '#F3F4F6',
  statusBar: 'light-content',
};

/** Resolve a palette from a 'light' | 'dark' scheme. */
export const getColors = scheme => (scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS);

// Default static export — the light palette. Unmigrated screens import this.
export const COLORS = LIGHT_COLORS;

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

export const APPOINTMENT_STATUS_COLORS = {
  pending: '#F59E0B',
  booked: '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
};

export const APPOINTMENT_DETAIL_STATUS_COLORS = {
  pending: '#F59E0B',
  booked: '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
};
