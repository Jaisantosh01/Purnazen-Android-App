import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const DURATION = 3000;
const SLIDE_OFFSET = -80;

const PRESETS = {
  success: { bg: COLORS.primary,        icon: '✓' },
  error:   { bg: '#EF4444',             icon: '✕' },
  info:    { bg: COLORS.textSecondary,  icon: 'i' },
  warning: { bg: COLORS.warning,        icon: '!' },
};

const Toast = ({ message, type = 'success', visible, onHide }) => {
  const translateY = useRef(new Animated.Value(SLIDE_OFFSET)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SLIDE_OFFSET, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,            duration: 250, useNativeDriver: true }),
    ]).start(onHide);
  }, [translateY, opacity, onHide]);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0,  useNativeDriver: true, bounciness: 4 }),
      Animated.timing(opacity,    { toValue: 1,  duration: 200, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(hide, DURATION);
    return () => clearTimeout(timer);
  }, [visible, hide, translateY, opacity]);

  if (!visible && !message) return null;

  const preset = PRESETS[type] || PRESETS.info;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: preset.bg, transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{preset.icon}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
};

export default Toast;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.white,
    lineHeight: 20,
  },
});
