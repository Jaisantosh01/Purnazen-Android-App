import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { canPopToStackRoot } from '../navigation/backHelpers';

/**
 * ScreenHeader — the single source of truth for the top "header card".
 *
 * IMPORTANT: this file is intentionally byte-identical across mobile-users,
 * mobile-doctors and mobile-admin (per-app branding comes from each app's
 * theme tokens: headerBg / headerText / surface / …). If you change it here,
 * copy the change to the other two apps.
 *
 * Solves three long-standing inconsistencies:
 *   1. Back button — shown automatically whenever the stack can go back (or a
 *      custom `onBack` is supplied), with a safe `canGoBack()` guard so it
 *      never dead-taps. Override with `showBack` / `onBack`.
 *   2. Height — derived from the device safe-area inset (not hardcoded 50–60px
 *      per screen), so every header lines up.
 *   3. Theming — colors come from useTheme(), so headers follow dark mode.
 *
 * Props:
 *   title         (string, required)
 *   subtitle      (string)
 *   hideTitle     (boolean) if true, the title text is not rendered
 *   subtitleRight (string) text rendered at the trailing edge of the subtitle row
 *   variant       'brand' (solid hero, default) | 'light' (surface card)
 *   showBack      force-show/hide the back button (defaults to canGoBack())
 *   onBack        custom back handler (defaults to navigation.goBack)
 *   backBehavior  'goBack' (default, step one screen) | 'popToRoot' (jump to
 *                 the tab stack root — use on browse/leaf screens where the
 *                 intermediate stack does not need to be preserved)
 *   right         node rendered on the trailing edge
 *   underColor    color painted BEHIND the curved bottom corners. Defaults to
 *                 colors.background (the standard page canvas); pass the screen's
 *                 canvas color if it differs (e.g. a chat screen on colors.card),
 *                 otherwise the corner cutouts flash a mismatched color in dark mode.
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
  subtitleRight = null,
  hideTitle = false,
  variant = 'brand',
  showBack,
  onBack,
  backBehavior = 'goBack',
  right = null,
  underColor,
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
  // An explicit onBack (e.g. a screen-internal mode switch) always earns a
  // back button, even when the navigation stack itself can't go back.
  const backVisible = showBack === undefined ? !!onBack || canGoBack : showBack;

  const handleBack = () => {
    if (onBack) return onBack();
    // Use this stack's depth — not canGoBack() — or POP_TO_TOP errors when only
    // a parent navigator has history.
    if (
      backBehavior === 'popToRoot' &&
      typeof navigation?.popToTop === 'function' &&
      canPopToStackRoot(navigation)
    ) {
      return navigation.popToTop();
    }
    if (canGoBack) navigation.goBack();
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
      {/* The wrapper paints the area BEHIND the curved bottom corners. Without
          it the cutouts show each screen's root color (white on unthemed
          roots), which flashes visibly against the dark canvas in dark mode. */}
      <View style={{ backgroundColor: underColor || colors.background }}>
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
          {!hideTitle && (
            <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {subtitle || subtitleRight ? (
            <View style={styles.subtitleRow}>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: subFg }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              {subtitleRight ? (
                <Text style={[styles.subtitleRight, { color: subFg }]} numberOfLines={1}>
                  {subtitleRight}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.rightWrap}>{right}</View>
      </View>
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
  // minHeight reserves the two-line (title + subtitle) footprint even when a
  // screen has no subtitle, so every header renders at the same height.
  titleWrap: { flex: 1, minHeight: 46, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitleRow: { flexDirection: 'row', alignItems: 'center' },
  subtitle: { fontSize: 13, marginTop: 2 },
  subtitleRight: { fontSize: 11, marginLeft: 8 },
  rightWrap: { minWidth: 4, alignItems: 'flex-end', justifyContent: 'center' },
});
