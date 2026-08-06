/**
 * Shared modal chrome.
 *
 * Dark mode was the problem this exists to solve: `card` (#1F1813) sitting on a
 * dimmed `background` (#14100C) are close enough in value that dialogs looked
 * fused with the page behind them. Every popup should take its backdrop and
 * card surface from here rather than hard-coding `rgba(0,0,0,0.3)` + `colors.card`,
 * so the separation stays consistent across screens.
 *
 * Usage:
 *   const styles = useMemo(() => makeStyles(colors), [colors]);
 *   ...
 *   modalOverlay: { ...modalChrome(colors).overlay, padding: 20 },
 *   modalCard:    { ...modalChrome(colors).card },
 */

export const modalChrome = colors => ({
  /** Full-screen dimmed backdrop. Add your own justifyContent/padding. */
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
  },

  /** Heavier dim for popups that sit over busy content (e.g. a video). */
  overlayStrong: {
    flex: 1,
    backgroundColor: colors.overlayStrong,
  },

  /** The dialog surface: lifted colour + visible edge + elevation. */
  card: {
    backgroundColor: colors.modalSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.modalBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },

  /** Bottom-sheet variant — same surface, rounded on the top edge only. */
  sheet: {
    backgroundColor: colors.modalSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.modalBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
});

export default modalChrome;
