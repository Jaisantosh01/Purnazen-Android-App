import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Animated } from 'react-native';
import useTheme from '../hooks/useTheme';

/**
 * AppToggle — a polished drop-in replacement for React Native's <Switch>.
 *
 * Themed track (primary when on, neutral when off) with a soft sliding thumb
 * and a smooth on/off crossfade. Mirrors the Switch API (value / onValueChange
 * / disabled) so call sites swap over mechanically.
 *
 * IMPORTANT: intentionally byte-identical across mobile-users, mobile-doctors
 * and mobile-admin (same convention as ScreenHeader / ThemeToggle). If you
 * change it here, copy the change to the other two apps.
 */
const W = 48;
const H = 28;
const THUMB = 22;
const PAD = 3;

export default function AppToggle({ value, onValueChange, disabled = false }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 190,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderStrong, colors.primary],
  });
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, W - THUMB - PAD],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange?.(!value)}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
      style={disabled ? styles.disabled : null}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: W,
    height: H,
    borderRadius: H / 2,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  disabled: { opacity: 0.45 },
});
