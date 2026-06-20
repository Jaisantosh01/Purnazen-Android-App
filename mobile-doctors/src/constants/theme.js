/**
 * Design tokens for the doctor app.
 *
 * Mirrors the patient app's token structure (mobile-users) so shared components
 * port over cleanly, but uses a distinct clinical-blue `primary` so the two
 * apps are visually distinguishable at a glance.
 */
export const COLORS = {
  // Brand — clinical blue (patient app is wellness-green)
  primary: '#2563EB',
  primaryLight: '#E8F0FE',
  primaryFaint: '#F2F6FF',
  accent: '#0E7490',
  accentLight: '#E0F2FE',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#1FA77A',

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
