import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * Quick-relief card. `bg`/`color` come from the backend card record and are
 * designed against a light surface, so in dark mode the card renders as a
 * translucent wash of the accent hue on the dark surface instead.
 * `sub` is the subtitle text (server `subtitle` field).
 */
const QuickCard = ({ title, iconName, onPress, bg, color, sub }) => {
  const { colors, isDark } = useTheme();
  const accent = color || colors.primary;
  const cardBg = isDark ? accent + '26' : bg || colors.card;
  const titleColor = isDark ? colors.textPrimary : color || colors.textPrimary;

  return (
    <TouchableOpacity
      style={[styles.box, { backgroundColor: cardBg }]}
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
