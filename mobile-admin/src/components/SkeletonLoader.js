import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { RADIUS, SPACING } from '../constants/theme';
import useTheme from '../hooks/useTheme';

const SkeletonBox = ({ width, height, style, borderRadius = RADIUS.sm }) => {
  const { colors } = useTheme();
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
      style={[{ width, height, borderRadius, backgroundColor: colors.surfaceMuted, opacity }, style]}
    />
  );
};

export const CardSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
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
};

export const ListSkeleton = ({ count = 4 }) => (
  <View style={{ paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </View>
);

export const ProgramSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
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
};

export const StatsSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={styles.statsRow}>
    {[1, 2, 3].map(i => (
      <View key={i} style={styles.statBox}>
        <SkeletonBox width={32} height={22} />
        <SkeletonBox width={48} height={11} style={{ marginTop: SPACING.xs }} />
      </View>
    ))}
  </View>
  );
};

// Doctor Leave Management — stats row (3 bordered cards)
export const LeaveStatsSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={styles.leaveStatsRow}>
    {[1, 2, 3].map(i => (
      <View key={i} style={styles.leaveStatCard}>
        <SkeletonBox width={28} height={20} />
        <SkeletonBox width={48} height={11} style={{ marginTop: 4 }} />
      </View>
    ))}
  </View>
  );
};

// Doctor Leave Management — leave card
export const LeaveCardSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={styles.leaveCard}>
    <View style={styles.leaveCardHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SkeletonBox width={20} height={20} borderRadius={10} />
        <SkeletonBox width={100} height={15} />
      </View>
      <SkeletonBox width={72} height={22} borderRadius={12} />
    </View>
    <View style={{ gap: 6, marginTop: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SkeletonBox width={16} height={16} borderRadius={8} />
        <SkeletonBox width={40} height={11} />
        <SkeletonBox width={100} height={13} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <SkeletonBox width={16} height={16} borderRadius={8} />
        <SkeletonBox width={28} height={11} />
        <SkeletonBox width={60} height={13} />
      </View>
    </View>
    <SkeletonBox width="100%" height={1} style={{ marginTop: 10 }} />
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
      <SkeletonBox style={{ flex: 1 }} height={36} borderRadius={8} />
      <SkeletonBox style={{ flex: 1 }} height={36} borderRadius={8} />
    </View>
  </View>
  );
};

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
export const WellnessRowSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: SPACING.md }]}>
    <SkeletonBox width={44} height={44} borderRadius={RADIUS.sm} />
    <View style={{ flex: 1, gap: SPACING.xs }}>
      <SkeletonBox width="55%" height={14} />
      <SkeletonBox width="35%" height={11} />
    </View>
    <SkeletonBox width={36} height={36} borderRadius={RADIUS.sm} />
  </View>
  );
};

// Home screen — quick relief square card
export const QuickCardSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={styles.quickCard}>
    <SkeletonBox width={40} height={40} borderRadius={RADIUS.sm} style={{ marginBottom: SPACING.sm }} />
    <SkeletonBox width="75%" height={13} />
    <SkeletonBox width="55%" height={11} style={{ marginTop: SPACING.xs }} />
  </View>
  );
};

// Face Glow screen — routine card
export const RoutineCardSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
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
};

// Select Symptom screen — symptom list row
// Doctor Detail — profile header + info card + awards/clinics
export const DoctorDetailSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View>
    <View style={styles.detailProfileHeader}>
      <SkeletonBox width={80} height={80} borderRadius={40} />
      <SkeletonBox width="50%" height={18} style={{ marginTop: 12 }} />
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        <SkeletonBox width={70} height={24} borderRadius={12} />
        <SkeletonBox width={80} height={24} borderRadius={12} />
      </View>
    </View>
    <View style={[styles.card, { marginHorizontal: 16 }]}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <View key={i}>
          <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12 }}>
            <SkeletonBox width={22} height={22} borderRadius={11} />
            <View style={{ flex: 1, gap: 4 }}>
              <SkeletonBox width={80} height={11} />
              <SkeletonBox width="70%" height={14} />
            </View>
          </View>
          {i < 6 && <SkeletonBox width="100%" height={1} />}
        </View>
      ))}
    </View>
  </View>
  );
};

export const SymptomRowSkeleton = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={[styles.cardRow, { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, gap: SPACING.md }]}>
    <SkeletonBox width={48} height={48} borderRadius={RADIUS.sm} />
    <View style={{ flex: 1, gap: SPACING.xs }}>
      <SkeletonBox width="50%" height={14} />
      <SkeletonBox width="70%" height={11} />
    </View>
    <SkeletonBox width={20} height={20} borderRadius={RADIUS.sm} />
  </View>
  );
};

// Edit Doctor — form skeleton (label + input pairs, tags, slots, sections)
export const EditFormSkeleton = () => {
  const { colors } = useTheme();
  return (
  <View style={{ padding: 20 }}>
    {[1, 2, 3, 4, 5, 6].map(i => (
      <View key={i} style={{ marginBottom: 14 }}>
        <SkeletonBox width={100} height={12} style={{ marginBottom: 8 }} />
        <SkeletonBox width="100%" height={44} borderRadius={8} />
      </View>
    ))}
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
      <SkeletonBox width={80} height={28} borderRadius={14} />
      <SkeletonBox width={100} height={28} borderRadius={14} />
      <SkeletonBox width={60} height={28} borderRadius={14} />
    </View>
    <SkeletonBox width="40%" height={16} style={{ marginBottom: 12, marginTop: 8 }} />
    {[1, 2, 3, 4, 5].map(i => (
      <View key={`slot${i}`} style={{ marginBottom: 10 }}>
        <SkeletonBox width={60} height={14} style={{ marginBottom: 6 }} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <SkeletonBox width={80} height={28} borderRadius={14} />
          <SkeletonBox width={80} height={28} borderRadius={14} />
          <SkeletonBox width={80} height={28} borderRadius={14} />
        </View>
      </View>
    ))}
    <SkeletonBox width="30%" height={16} style={{ marginBottom: 12, marginTop: 8 }} />
    <View style={{ backgroundColor: colors.surfaceMuted, padding: 12, borderRadius: 8, marginBottom: 12 }}>
      <SkeletonBox width={80} height={12} style={{ marginBottom: 8 }} />
      <SkeletonBox width="100%" height={44} borderRadius={8} />
      <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
        <SkeletonBox style={{ flex: 1 }} height={44} borderRadius={8} />
        <SkeletonBox width={60} height={44} borderRadius={8} />
      </View>
    </View>
  </View>
  );
};

// Upload Video — directory grid skeleton (folder icons in 3 columns)
export const DirGridSkeleton = () => {
  const { colors } = useTheme();
  return (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 8, justifyContent: 'center' }}>
    {[1, 2, 3, 4, 5, 6].map(i => (
      <View key={i} style={{
        width: '30%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', padding: 8,
      }}>
        <SkeletonBox width={28} height={28} borderRadius={4} />
        <SkeletonBox width="70%" height={11} style={{ marginTop: 8 }} />
      </View>
    ))}
  </View>
  );
};

export default SkeletonBox;

const makeStyles = colors => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
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
  detailProfileHeader: {
    alignItems: 'center', paddingVertical: 24,
  },
  quickCard: {
    width: '47%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  leaveStatsRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8,
  },
  leaveStatCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  leaveCard: {
    backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 16, marginBottom: 10,
    padding: 14, elevation: 1,
  },
  leaveCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
});
