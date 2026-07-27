import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from './ScreenHeader';

/**
 * TabHeader — the scrolling hero card at the top of the bottom-tab screens
 * (Home, Relief, Wellness).
 *
 * These three each had their own copy of the header styles, which had drifted:
 * Home rounded its bottom corners at 28 while Relief and Wellness used
 * RADIUS.lg (16), and the horizontal padding, title weight and subtitle spacing
 * all differed too, so the card visibly changed shape between tabs. The metrics
 * here are Home's, which is the one that was right.
 *
 * Distinct from <ScreenHeader/>: that one is a fixed bar for pushed/stack
 * screens and owns the back button. This is a taller branded banner that
 * scrolls away with the content and carries no navigation affordance.
 *
 * Props:
 *   title      (string, required)
 *   subtitle   (string)
 *   background (color) override for the hero fill — Wellness keeps a fixed
 *              accent-purple banner across both schemes. Defaults to
 *              colors.headerBg.
 *   right      node pinned to the trailing edge of the title row (Home's bell)
 *   children   extra content below the subtitle (Wellness's stats row)
 */
export default function TabHeader({ title, subtitle, background, right = null, children }) {
  const { colors } = useTheme();
  const paddingTop = useHeaderTopPadding(16);
  const bg = background || colors.headerBg;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={bg} />
      <View style={[styles.header, { backgroundColor: bg, paddingTop }]}>
        <View style={styles.row}>
          <View style={styles.textCol}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
        {children ? <View style={styles.extra}>{children}</View> : null}
      </View>
    </>
  );
}

// Fixed rather than themed: the hero is always a saturated brand fill, so its
// text is white on both schemes.
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  textCol: { flex: 1 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    color: 'rgba(255,255,255,0.75)',
  },
  extra: { marginTop: 20 },
});
