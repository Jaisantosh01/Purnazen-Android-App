/**
 * Design tokens for the doctor app.
 *
 * Mirrors the patient app's token structure (mobile-users) so shared components
 * port over cleanly, but uses a distinct clinical-blue `primary` so the apps are
 * visually distinguishable at a glance.
 *
 * Dark mode: prefer the `useTheme()` hook (src/hooks/useTheme.js) which returns
 * the active palette. The static `COLORS` export below is the LIGHT palette and
 * stays the default for screens not yet migrated to the hook.
 */

// Brand hues are shared across light/dark — only surfaces/text flip.
const BRAND = {
  primary: '#2563EB',   // clinical blue
  accent: '#0E7490',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#1FA77A',
  white: '#FFFFFF',
  black: '#000000',
};

export const LIGHT_COLORS = {
  ...BRAND,

  primaryLight: '#E8F0FE',
  primaryFaint: '#F2F6FF',
  accentLight: '#E0F2FE',

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

  // Header card — keeps the brand-blue hero on both schemes
  headerBg: '#2563EB',
  headerText: '#FFFFFF',
  statusBar: 'light-content',
};

export const DARK_COLORS = {
  ...BRAND,

  // A slightly lighter primary reads better on dark surfaces
  primary: '#5189F2',
  primaryLight: '#16223A',
  primaryFaint: '#101827',
  accent: '#3494AC',
  accentLight: '#11293A',

  // Text
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A7B0',
  textMuted: '#6B7280',

  // Surfaces — cool-tinted neutrals
  background: '#0F1216',
  card: '#1A1F26',
  surface: '#1A1F26',
  surfaceMuted: '#232932',
  border: '#2C333D',
  borderStrong: '#3A434F',

  headerBg: '#16223A',
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
