/**
 * Canonical design tokens for the admin app.
 *
 * Mirrors the patient app's token structure (mobile-users) so shared screens and
 * components port over cleanly, but keeps the admin app's distinct burnt-orange
 * brand so the three apps are visually distinguishable at a glance.
 *
 * Dark mode: prefer the `useTheme()` hook (src/hooks/useTheme.js) which returns
 * the active palette. The static `COLORS` export below is the LIGHT palette and
 * stays the default for screens not yet migrated to the hook.
 */

// Brand hues are shared across light/dark — only surfaces/text flip.
const BRAND = {
  primary: '#EA580C',   // burnt orange
  accent: '#9A3412',    // deep burnt orange
  warning: '#EAB308',
  danger: '#DC2626',
  white: '#FFFFFF',
  black: '#000000',
};

export const LIGHT_COLORS = {
  ...BRAND,

  primaryLight: '#FFF7ED',
  primaryFaint: '#FFFBF5',
  accentLight: '#FEE2E2',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // Surfaces
  background: '#FFFDF9',     // warm off-white
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',
  border: '#FED7AA',         // soft orange border
  borderStrong: '#FDBA74',

  // Modal/dialog surfaces. In light mode a plain white card on a dimmed page
  // already separates itself; the tokens exist so dark mode can lift the card
  // above the background instead of matching it.
  overlay: 'rgba(0,0,0,0.4)',
  overlayStrong: 'rgba(0,0,0,0.55)',
  modalSurface: '#FFFFFF',
  modalBorder: '#FED7AA',

  // Header card — keeps the brand-orange hero on both schemes
  headerBg: '#EA580C',
  headerText: '#FFFFFF',
  statusBar: 'light-content',
};

export const DARK_COLORS = {
  ...BRAND,

  // A slightly warmer/brighter primary reads better on dark surfaces
  primary: '#FB7A3C',
  primaryLight: '#3A1E0E',
  primaryFaint: '#27160C',
  accent: '#C2622E',
  accentLight: '#3A1E1A',

  // Text
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A7B0',
  textMuted: '#6B7280',

  // Surfaces — warm-tinted neutrals
  background: '#14100C',
  card: '#1F1813',
  surface: '#1F1813',
  surfaceMuted: '#2A211A',
  border: '#352A20',
  borderStrong: '#43352A',

  // A dark card at `card` on a dimmed `background` is nearly the same value —
  // popups read as part of the page. Lift the modal surface a step and dim the
  // page harder so the dialog has an unmistakable edge.
  overlay: 'rgba(0,0,0,0.7)',
  overlayStrong: 'rgba(0,0,0,0.78)',
  modalSurface: '#2E241C',
  modalBorder: '#53412F',

  headerBg: '#3A1E0E',
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
