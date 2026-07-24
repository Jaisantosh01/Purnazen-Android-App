import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

const GENDERS = [
  { value: 'Male', icon: 'gender-male' },
  { value: 'Female', icon: 'gender-female' },
  { value: 'Other', icon: 'gender-non-binary' },
];

/**
 * Male / Female / Other chip picker. Tapping the active chip clears it (gender
 * is optional). `value` is the stored string ('' when unset); `onChange` gets
 * the next value.
 */
export default function GenderSelect({ value, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {GENDERS.map(g => {
        const active = value === g.value;
        return (
          <TouchableOpacity
            key={g.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(active ? '' : g.value)}
            activeOpacity={0.85}
          >
            <MCIcon name={g.icon} size={18} color={active ? colors.white : colors.textSecondary} />
            <Text style={[styles.text, active && styles.textActive]}>{g.value}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 13.5, fontWeight: '600', color: colors.textSecondary },
  textActive: { color: colors.white },
});
