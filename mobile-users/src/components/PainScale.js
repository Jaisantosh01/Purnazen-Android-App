import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import useTheme from '../hooks/useTheme';

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * 0–10 pain selector shared by the before/after therapy prompts.
 *
 * `value` is a number (or null when nothing is picked yet) and `onChange` gets
 * the next number. The scale is rendered as tap targets rather than a drag
 * slider: inside a dialog a slider competes with the backdrop's pan handling,
 * which is what made the old popup awkward to use on a phone.
 */
export default function PainScale({ value, onChange, label = 'Pain level' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const selected = typeof value === 'number' ? value : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}: {selected == null ? '—' : `${selected}/10`}
      </Text>
      <View style={styles.row}>
        {LEVELS.map(n => {
          const active = selected === n;
          return (
            <TouchableOpacity
              key={n}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => onChange(n)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={styles.legendText}>No pain</Text>
        <Text style={styles.legendText}>Worst</Text>
      </View>
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    minWidth: 34,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  pillTextActive: { color: colors.white },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  legendText: { fontSize: 11, color: colors.textMuted },
});
