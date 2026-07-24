import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * ThemeToggle — animated sun/moon pill that flips the app between light and
 * dark mode. Designed to live in a ScreenHeader `right` slot: its track and
 * thumb use translucent-white / white surfaces so it reads on the brand hero
 * in both schemes, while the active icon picks up the header brand color.
 *
 * IMPORTANT: this file is intentionally byte-identical across mobile-users,
 * mobile-doctors and mobile-admin (same convention as ScreenHeader). If you
 * change it here, copy the change to the other two apps.
 */
const TRACK_W = 62;
const TRACK_H = 30;
const THUMB = 24;
const PAD = 3;

export default function ThemeToggle() {
  const { colors, isDark, setMode } = useTheme();
  const anim = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isDark ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 80,
    }).start();
  }, [isDark, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, TRACK_W - THUMB - PAD],
  });
  const sunOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const moonOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Pressable
      onPress={() => setMode(isDark ? 'light' : 'dark')}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel="Toggle dark mode"
      style={styles.track}
    >
      {/* Faint rail icons — the one NOT under the thumb stays visible. */}
      <MCIcon name="white-balance-sunny" size={14} color="rgba(255,255,255,0.7)" style={styles.railLeft} />
      <MCIcon name="moon-waning-crescent" size={13} color="rgba(255,255,255,0.7)" style={styles.railRight} />

      {/* Sliding thumb carrying the active icon (crossfaded). */}
      <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]}>
        <Animated.View style={[styles.thumbIcon, { opacity: sunOpacity }]}>
          <MCIcon name="white-balance-sunny" size={15} color={colors.headerBg} />
        </Animated.View>
        <Animated.View style={[styles.thumbIcon, { opacity: moonOpacity }]}>
          <MCIcon name="moon-waning-crescent" size={14} color={colors.headerBg} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
  },
  railLeft: { position: 'absolute', left: 7 },
  railRight: { position: 'absolute', right: 7 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  thumbIcon: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
