import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';

/**
 * Reusable "scaffold" body for screens whose features aren't built yet.
 * Renders an icon, title, description, an optional bullet list of intended
 * features, and (optionally) the backend endpoint(s) the screen will use — so
 * the skeleton documents itself.
 */
const Placeholder = ({ icon = 'hammer-wrench', title, description, features = [], endpoint }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <ScrollView contentContainerStyle={styles.scroll}>
    <View style={styles.iconWrap}>
      <MCIcon name={icon} size={40} color={colors.primary} />
    </View>

    <Text style={styles.title}>{title}</Text>
    {description ? <Text style={styles.desc}>{description}</Text> : null}

    <View style={styles.badge}>
      <MCIcon name="progress-wrench" size={14} color={colors.primary} />
      <Text style={styles.badgeText}>Scaffolded — feature not yet implemented</Text>
    </View>

    {features.length > 0 && (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Planned</Text>
        {features.map(f => (
          <View key={f} style={styles.bulletRow}>
            <MCIcon name="checkbox-blank-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.bulletText}>{f}</Text>
          </View>
        ))}
      </View>
    )}

    {endpoint ? (
      <View style={styles.endpointBox}>
        <Text style={styles.endpointLabel}>Backend</Text>
        <Text style={styles.endpointText}>{endpoint}</Text>
      </View>
    ) : null}
  </ScrollView>
  );
};

export default Placeholder;

const makeStyles = colors => StyleSheet.create({
  scroll: { padding: SPACING.xl, alignItems: 'center' },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  desc: {
    fontSize: 14.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 21,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryFaint,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: SPACING.lg,
  },
  badgeText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    marginTop: SPACING.xl,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  bulletText: { fontSize: 14, color: colors.textSecondary, flex: 1 },
  endpointBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  endpointLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  endpointText: { fontSize: 13, color: colors.textSecondary, fontFamily: 'monospace' },
});
