import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

const SkeletonBox = ({ width, height, style, borderRadius = RADIUS.sm }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: COLORS.surfaceMuted, opacity }, style]}
    />
  );
};

export const CardSkeleton = () => (
  <View style={styles.card}>
    <View style={styles.cardRow}>
      <SkeletonBox width={52} height={52} borderRadius={RADIUS.sm} />
      <View style={styles.cardLines}>
        <SkeletonBox width="70%" height={14} />
        <SkeletonBox width="50%" height={11} style={{ marginTop: SPACING.xs }} />
        <SkeletonBox width="40%" height={11} style={{ marginTop: SPACING.xs }} />
      </View>
    </View>
    <SkeletonBox width="100%" height={1} style={{ marginTop: SPACING.md }} />
    <View style={[styles.cardRow, { marginTop: SPACING.md }]}>
      <SkeletonBox width={80} height={18} borderRadius={RADIUS.sm} />
      <SkeletonBox width={100} height={28} borderRadius={RADIUS.pill} />
    </View>
  </View>
);

export const ListSkeleton = ({ count = 4 }) => (
  <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </View>
);

export const ProgramSkeleton = () => (
  <View style={styles.card}>
    <View style={styles.cardRow}>
      <SkeletonBox width={52} height={52} borderRadius={RADIUS.sm} />
      <View style={styles.cardLines}>
        <SkeletonBox width="65%" height={14} />
        <SkeletonBox width="80%" height={11} style={{ marginTop: SPACING.xs }} />
        <SkeletonBox width="50%" height={11} style={{ marginTop: SPACING.xs }} />
      </View>
      <SkeletonBox width={34} height={34} borderRadius={17} />
    </View>
  </View>
);

export const StatsSkeleton = () => (
  <View style={styles.statsRow}>
    {[1, 2, 3].map(i => (
      <View key={i} style={styles.statBox}>
        <SkeletonBox width={32} height={22} />
        <SkeletonBox width={48} height={11} style={{ marginTop: SPACING.xs }} />
      </View>
    ))}
  </View>
);

export const SessionPlayerSkeleton = () => (
  <View>
    <SkeletonBox width="100%" height={200} borderRadius={0} />
    <View style={{ padding: SPACING.lg }}>
      <SkeletonBox width="60%" height={18} />
      <SkeletonBox width="40%" height={13} style={{ marginTop: SPACING.xs }} />
      <SkeletonBox width="100%" height={60} borderRadius={RADIUS.md} style={{ marginTop: SPACING.lg }} />
      {[1, 2, 3].map(i => (
        <SkeletonBox key={i} width="100%" height={52} borderRadius={RADIUS.sm} style={{ marginTop: SPACING.sm }} />
      ))}
    </View>
  </View>
);

// Home screen — wellness row (icon + title + duration + chevron)
export const WellnessRowSkeleton = () => (
  <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: SPACING.md }]}>
    <SkeletonBox width={44} height={44} borderRadius={RADIUS.sm} />
    <View style={{ flex: 1, gap: SPACING.xs }}>
      <SkeletonBox width="55%" height={14} />
      <SkeletonBox width="35%" height={11} />
    </View>
    <SkeletonBox width={36} height={36} borderRadius={RADIUS.sm} />
  </View>
);

// Home screen — quick relief square card
export const QuickCardSkeleton = () => (
  <View style={styles.quickCard}>
    <SkeletonBox width={40} height={40} borderRadius={RADIUS.sm} style={{ marginBottom: SPACING.sm }} />
    <SkeletonBox width="75%" height={13} />
    <SkeletonBox width="55%" height={11} style={{ marginTop: SPACING.xs }} />
  </View>
);

// Face Glow screen — routine card
export const RoutineCardSkeleton = () => (
  <View style={[styles.card, { marginBottom: SPACING.md }]}>
    <View style={[styles.cardRow, { alignItems: 'flex-start' }]}>
      <SkeletonBox width={44} height={44} borderRadius={RADIUS.sm} style={{ marginRight: SPACING.md }} />
      <View style={{ flex: 1, gap: SPACING.xs }}>
        <SkeletonBox width="65%" height={14} />
        <SkeletonBox width="85%" height={11} />
        <SkeletonBox width="70%" height={11} />
        <SkeletonBox width="60%" height={11} />
      </View>
      <SkeletonBox width={36} height={36} borderRadius={18} style={{ marginLeft: SPACING.sm }} />
    </View>
  </View>
);

// Select Symptom screen — symptom list row
export const SymptomRowSkeleton = () => (
  <View style={[styles.cardRow, { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, gap: SPACING.md }]}>
    <SkeletonBox width={48} height={48} borderRadius={RADIUS.sm} />
    <View style={{ flex: 1, gap: SPACING.xs }}>
      <SkeletonBox width="50%" height={14} />
      <SkeletonBox width="70%" height={11} />
    </View>
    <SkeletonBox width={20} height={20} borderRadius={RADIUS.sm} />
  </View>
);

export default SkeletonBox;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardLines: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  quickCard: {
    width: '47%',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
});
