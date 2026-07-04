import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';

const DURATION = 3000;
const SLIDE_OFFSET = -80;

const makePresets = colors => ({
  success: { bg: colors.success, icon: 'check' },
  error: { bg: colors.danger, icon: 'close' },
  info: { bg: colors.textSecondary, icon: 'information' },
  warning: { bg: colors.warning, icon: 'alert' },
});

const Toast = ({ message, type = 'success', visible, onHide }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(SLIDE_OFFSET)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: SLIDE_OFFSET, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onHide);
  }, [translateY, opacity, onHide]);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(hide, DURATION);
    return () => clearTimeout(timer);
  }, [visible, hide, translateY, opacity]);

  if (!visible && !message) return null;

  const presets = makePresets(colors);
  const preset = presets[type] || presets.info;

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: preset.bg, transform: [{ translateY }], opacity }]}
      pointerEvents="none">
      <View style={styles.iconCircle}>
        <MCIcon name={preset.icon} size={14} color={colors.white} />
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
};

export default Toast;

const makeStyles = colors => StyleSheet.create({
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
  icon: { fontSize: 12, fontWeight: '700', color: colors.white },
  message: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.white, lineHeight: 20 },
});
