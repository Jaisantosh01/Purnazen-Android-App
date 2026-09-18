import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { RADIUS, SPACING } from '../constants/theme';

/**
 * EmptyState — the one "nothing here" block for lists, searches and sections.
 * Byte-identical across mobile-users, mobile-doctors and mobile-admin; copy
 * changes over.
 *
 * Props:
 *   icon     MaterialCommunityIcons name (default 'inbox-outline')
 *   title    short headline ("No appointments yet")
 *   hint     one line of guidance under the title
 *   action   { label, onPress } optional primary button
 *   compact  tighter padding for use inside a card/section rather than a page
 *   accent   override the tint (defaults to colors.primary) — feature sub-brands
 */
export default function EmptyState({ icon = 'inbox-outline', title, hint, action, compact = false, accent, style }) {
  const { colors } = useTheme();
  const tint = accent || colors.primary;
  const tintBg = accent ? `${accent}22` : colors.primaryLight;
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <View style={[styles.iconWrap, { backgroundColor: tintBg }]}>
        <MCIcon name={icon} size={compact ? 26 : 34} color={tint} />
      </View>
      {title ? <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text> : null}
      {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      {action ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: tint }]}
          onPress={action.onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: SPACING.xxl * 1.5, paddingHorizontal: SPACING.xl },
  wrapCompact: { paddingVertical: SPACING.xl },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center', marginTop: SPACING.xs, lineHeight: 19, maxWidth: 280 },
  btn: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
