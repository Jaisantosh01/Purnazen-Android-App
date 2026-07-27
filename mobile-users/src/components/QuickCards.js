import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { reliefCardColors } from '../utils/cardTheme';

/**
 * Quick-relief card. `bg`/`color` come from the backend card record and are
 * designed against a light surface, so in dark mode the card renders as a
 * wash of the accent hue composited onto the dark surface instead — see
 * utils/cardTheme, which the Relief tab's larger cards share.
 * `sub` is the subtitle text (server `subtitle` field).
 */
const QuickCard = ({ title, iconName, onPress, bg, color, sub }) => {
  const { colors, isDark } = useTheme();
  const card = reliefCardColors({ bg, fg: color, colors, isDark });

  return (
    <TouchableOpacity
      style={[styles.box, { backgroundColor: card.background }, isDark && styles.boxDark]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <MCIcon name={iconName} size={30} color={card.accent} style={styles.icon} />
      <Text style={[styles.boxTitle, { color: card.title }]}>{title}</Text>
      <Text style={[styles.boxSub, { color: card.subtitle }]}>
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
