import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import { getColors } from '../constants/theme';
import { useThemeStore } from '../store/themeStore';

/**
 * useTheme — resolves the user's preference (`mode`) plus the live OS color
 * scheme into the active palette.
 *
 * Returns: { colors, scheme, isDark, mode, setMode }
 *
 *   const { colors, isDark } = useTheme();
 *   const styles = makeStyles(colors);   // build StyleSheet in render
 *
 * Screens migrated to dark mode should build their StyleSheet from `colors`
 * (e.g. via a `makeStyles(colors)` factory) instead of importing the static
 * COLORS export.
 */
export default function useTheme() {
  const mode = useThemeStore(s => s.mode);
  const setMode = useThemeStore(s => s.setMode);

  const [systemScheme, setSystemScheme] = useState(
    Appearance.getColorScheme() || 'light',
  );

  // Track live OS appearance changes (only matters while mode === 'system').
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => sub.remove();
  }, []);

  const scheme = mode === 'system' ? systemScheme : mode;
  const isDark = scheme === 'dark';

  return {
    colors: getColors(scheme),
    scheme,
    isDark,
    mode,
    setMode,
  };
}
