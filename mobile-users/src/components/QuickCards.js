import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * Blend `hex` over `base` at `alpha`, returning an opaque colour.
 *
 * The dark-mode tint used to be an 8-digit "#RRGGBB26" applied straight to the
 * card. A translucent background plus Android `elevation` makes the elevation
 * shadow show through and ring the view, which is what read as a heavy border
 * around every card. Compositing here keeps the same tint while leaving the
 * background fully opaque.
 */
const blend = (hex, base, alpha) => {
  const parse = h => {
    const v = h.replace('#', '');
    const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v.slice(0, 6);
    return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  };
  try {
    const [r1, g1, b1] = parse(hex);
    const [r2, g2, b2] = parse(base);
    const mix = (a, b) => Math.round(a * alpha + b * (1 - alpha));
    return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`;
  } catch (e) {
    return base;
  }
};

/**
 * Quick-relief card. `bg`/`color` come from the backend card record and are
 * designed against a light surface, so in dark mode the card renders as a
 * wash of the accent hue composited onto the dark surface instead.
 * `sub` is the subtitle text (server `subtitle` field).
 */
const QuickCard = ({ title, iconName, onPress, bg, color, sub }) => {
  const { colors, isDark } = useTheme();
  const accent = color || colors.primary;
  const cardBg = isDark ? blend(accent, colors.card, 0.15) : bg || colors.card;
  const titleColor = isDark ? colors.textPrimary : color || colors.textPrimary;

  return (
    <TouchableOpacity
      style={[styles.box, { backgroundColor: cardBg }, isDark && styles.boxDark]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <MCIcon name={iconName} size={30} color={accent} style={styles.icon} />
      <Text style={[styles.boxTitle, { color: titleColor }]}>{title}</Text>
      <Text style={[styles.boxSub, { color: colors.textMuted }]}>
        {sub || 'Instant relief'}
      </Text>
    </TouchableOpacity>
  );
};

export default QuickCard;

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    padding: 16,
    width: '47%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  // Dark surfaces don't need the lift, and dropping elevation removes the last
  // trace of the shadow ring around the tinted card.
  boxDark: {
    shadowOpacity: 0,
    elevation: 0,
  },
  icon: {
    marginBottom: 10,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  boxSub: {
    fontSize: 12,
    opacity: 0.7,
  },
});
