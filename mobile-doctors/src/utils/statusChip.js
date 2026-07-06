/**
 * Scheme-aware colors for a status chip config ({ bg, text, dot, darkText? }).
 *
 * Light: the designed pastel bg + deep text. Dark: a translucent wash of the
 * status hue + a light text variant, so chips sit on dark cards instead of
 * glaring as bright pastel pills.
 */
export const chipColors = (cfg, isDark) =>
  isDark
    ? { bg: cfg.dot + '26', text: cfg.darkText || cfg.dot }
    : { bg: cfg.bg, text: cfg.text };
