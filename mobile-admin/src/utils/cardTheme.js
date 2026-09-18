/**
 * Colour resolution for relief cards, shared by Home's <QuickCard/> and the
 * Relief tab's larger cards.
 *
 * The `background_color` / `text_color` pair on each card record is authored
 * against a LIGHT surface — pale pastel fill, saturated text. Painted as-is on
 * a dark canvas the card becomes a bright slab with muted grey body text on it,
 * which is what the Relief tab was doing while Home quietly composited instead.
 * Both now go through here, so the two can't drift apart again.
 */

/**
 * Blend `hex` over `base` at `alpha`, returning an opaque colour.
 *
 * The dark-mode tint used to be an 8-digit "#RRGGBB26" applied straight to the
 * card. A translucent background plus Android `elevation` makes the elevation
 * shadow show through and ring the view, which is what read as a heavy border
 * around every card. Compositing here keeps the same tint while leaving the
 * background fully opaque.
 */
export const blend = (hex, base, alpha) => {
  const parse = h => {
    const v = h.replace('#', '');
    const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v.slice(0, 6);
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  };
  try {
    const [r1, g1, b1] = parse(hex);
    const [r2, g2, b2] = parse(base);
    const mix = (a, b) => Math.round(a * alpha + b * (1 - alpha));
    return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
  } catch (e) {
    return base;
  }
};

// How much of the card's accent hue survives onto the dark surface. Enough to
// tell the cards apart at a glance, low enough that white body text still
// clears contrast on every hue the catalogue uses.
const DARK_TINT = 0.15;

/**
 * Resolve one relief card's palette.
 *
 * @param bg      card record `background_color` (light-mode fill)
 * @param fg      card record `text_color` (the card's accent hue)
 * @param colors  active palette from useTheme()
 * @param isDark  active scheme from useTheme()
 * @returns {{accent, background, title, subtitle}} — `accent` is for icons and
 *          call-to-action text, which read correctly on both schemes.
 */
export const reliefCardColors = ({ bg, fg, colors, isDark }) => {
  const accent = fg || colors.primary;
  return {
    accent,
    background: isDark ? blend(accent, colors.card, DARK_TINT) : bg || colors.card,
    // On a tinted dark card the authored accent is too low-contrast for a
    // heading, so the themed text colour takes over.
    title: isDark ? colors.textPrimary : accent,
    subtitle: isDark ? colors.textSecondary : colors.textMuted,
  };
};
