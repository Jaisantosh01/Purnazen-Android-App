import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * ScreenHeader — shared safe-area-aware top bar for admin screens.
 *
 * The app draws edge-to-edge, so screens that paint their own title bar must
 * pad below the system status bar themselves. Hardcoded values (12, 56, …)
 * either collide with the status bar or waste space depending on the device;
 * this component derives the padding from the live safe-area inset so it fits
 * every phone/tablet, and keeps title/back/action styling consistent.
 *
 * Props:
 *   title     — required screen title
 *   subtitle  — optional one-line description under the title
 *   onBack    — optional; renders a back arrow when provided
 *   right     — optional node rendered at the trailing edge (actions)
 */
/**
 * useHeaderTopPadding — safe-area top padding for screens that keep their own
 * custom header layout instead of <ScreenHeader/>. Replaces hardcoded
 * paddingTop values (12, 50, 56, …) that overlap the status bar on some
 * devices and waste space on others.
 */
export const useHeaderTopPadding = (extra = 12) => {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 12) + extra;
};

const ScreenHeader = ({ title, subtitle, onBack, right }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.card}
      />
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MCIcon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4, marginRight: 10 },
  titleBlock: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
  right: { marginLeft: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default ScreenHeader;
