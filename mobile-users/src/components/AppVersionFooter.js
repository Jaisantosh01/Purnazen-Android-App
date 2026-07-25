/**
 * Bottom-of-page brand + build stamp.
 *
 * The version is read from APP_VERSION (injected at build time from the gradle
 * versionName), never typed into the copy — screens used to carry a hardcoded
 * "v1.0.0" that silently went stale on every release.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '../hooks/useTheme';
import { APP_VERSION } from '../config';

export default function AppVersionFooter({ style }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.version}>Purnazen v{APP_VERSION}</Text>
      <View style={styles.poweredBy}>
        <Text style={styles.poweredByText}>Powered by </Text>
        <Text style={styles.poweredByBrand}>Calypsion</Text>
      </View>
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  version: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.2 },
  poweredBy: { flexDirection: 'row', alignItems: 'center' },
  poweredByText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.2 },
  poweredByBrand: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 0.2 },
});
