import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * ScreenHeader — the single source of truth for the top "header card".
 *
 * Solves three long-standing inconsistencies:
 *   1. Back button — shown automatically whenever the stack can go back, with a
 *      safe `canGoBack()` guard so it never dead-taps. Override with
 *      `showBack` / `onBack`.
 *   2. Height — derived from the device safe-area inset (not hardcoded 50–60px
 *      per screen), so every header lines up.
 *   3. Theming — colors come from useTheme(), so headers follow dark mode.
 *
 * Props:
 *   title      (string, required)
 *   subtitle   (string)
 *   variant    'brand' (solid hero, default) | 'light' (surface card)
 *   showBack   force-show/hide the back button (defaults to canGoBack())
 *   onBack     custom back handler (defaults to navigation.goBack)
 *   right      node rendered on the trailing edge
 */
/**
 * useHeaderTopPadding — safe-area top padding for screens that keep a custom
 * header layout instead of <ScreenHeader/>. Replaces hardcoded paddingTop
 * values (50–56px) that overlap the status bar on tall-inset devices and
 * waste space on short ones.
 */
export const useHeaderTopPadding = (extra = 12) => {
  const insetsCtx = useContext(SafeAreaInsetsContext);
  return Math.max(insetsCtx?.top ?? 0, 12) + extra;
};

export default function ScreenHeader({
  title,
  subtitle,
  variant = 'brand',
  showBack,
  onBack,
  right = null,
  navigation: navProp,
}) {
  // Read navigation + safe-area from context directly (rather than the throwing
  // useNavigation()/useSafeAreaInsets() hooks) so the header also renders in
  // isolation — e.g. unit tests that mount a screen outside NavigationContainer.
  const navContext = useContext(NavigationContext);
  const navigation = navProp || navContext;
  const insetsCtx = useContext(SafeAreaInsetsContext);
  const topInset = insetsCtx?.top ?? 0;
  const { colors, isDark } = useTheme();

  const canGoBack = !!navigation?.canGoBack?.();
  const backVisible = showBack === undefined ? canGoBack : showBack;

  const handleBack = () => {
    if (onBack) return onBack();
    if (navigation?.canGoBack?.()) navigation.goBack();
  };

  const brand = variant === 'brand';
  const bg = brand ? colors.headerBg : colors.surface;
  const fg = brand ? colors.headerText : colors.textPrimary;
  const subFg = brand ? 'rgba(255,255,255,0.85)' : colors.textSecondary;
  const backBg = brand ? 'rgba(255,255,255,0.2)' : colors.surfaceMuted;

  return (
    <>
      <StatusBar
        barStyle={brand || isDark ? 'light-content' : 'dark-content'}
        backgroundColor={bg}
      />
      <View
        style={[
          styles.header,
          {
            backgroundColor: bg,
            paddingTop: Math.max(topInset, 12) + 10,
            borderBottomLeftRadius: brand ? 24 : 0,
            borderBottomRightRadius: brand ? 24 : 0,
            borderBottomWidth: brand ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {backVisible ? (
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: backBg }]}
            onPress={handleBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MCIcon name="arrow-left" size={22} color={fg} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: subFg }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.rightWrap}>{right}</View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSpacer: { width: 4 },
  titleWrap: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  rightWrap: { minWidth: 4, alignItems: 'flex-end', justifyContent: 'center' },
});
