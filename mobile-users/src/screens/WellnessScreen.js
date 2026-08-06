import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import wellnessService from '../services/wellnessService';
import { ProgramSkeleton, StatsSkeleton } from '../components/SkeletonLoader';
import TabHeader from '../components/TabHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';

const WellnessScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [programs, setPrograms]     = useState([]);
  const [stats, setStats]           = useState(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const data = await wellnessService.getAllSessions();
      const sessions = data?.sessions || [];
      setPrograms(sessions.map(s => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle || '',
        icon: 'star-four-points-outline',
        duration:  s.duration,
        videoGroupId: s.videoGroupId,
      })));
      if (data?.stats) setStats(data.stats);
    } catch (err) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleProgram = (program) => {
    if (program.videoGroupId) {
      navigation.navigate('VideoPlayer', {
        groupId: program.videoGroupId,
        groupTitle: program.title,
        // Files the run as a wellness session, which is also what makes the
        // end-of-session prompt ask for a remark only, no pain score.
        sessionType: 'wellness',
      });
    } else {
      showAlert(
        'Coming soon',
        'Sessions for this program are being added. Please check back shortly.',
      );
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* ── Header ── */}
        <TabHeader
          title="Wellness"
          subtitle="Daily routines for a healthier you"
          background={COLORS.accent}
        >
          {isLoading ? (
            <StatsSkeleton />
          ) : stats ? (
            <View style={styles.statsRow}>
              {[
                { icon: 'target',       value: stats.sessions, label: 'Sessions' },
                { icon: 'timer-outline', value: stats.minutes,  label: 'Minutes'  },
                { icon: 'fire',          value: stats.streak,   label: 'Streak'   },
              ].map((stat, i, arr) => (
                <View key={i} style={[styles.statBox, i < arr.length - 1 && styles.statBorder]}>
                  <MCIcon name={stat.icon} size={26} color={COLORS.white} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </TabHeader>

        {/* ── Programs ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Programs</Text>
            <View style={styles.popularBadge}>
              <MCIcon name="trending-up" size={13} color={colors.primary} />
              <Text style={styles.popularText}> Popular</Text>
            </View>
          </View>

          {isLoading ? (
            [1, 2, 3].map(i => <ProgramSkeleton key={i} />)
          ) : error ? (
            <View style={styles.errorBox}>
              <MCIcon name="alert-circle-outline" size={40} color={colors.danger} />
              <Text style={styles.errorTitle}>Failed to load programs</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} activeOpacity={0.85}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : programs.length === 0 ? (
            <View style={styles.errorBox}>
              <MCIcon name="yoga" size={48} color={colors.border} />
              <Text style={styles.errorTitle}>No programs yet</Text>
            </View>
          ) : programs.map((program) => (
              <TouchableOpacity
                key={program.id}
                style={styles.programCard}
                activeOpacity={0.85}
                onPress={() => handleProgram(program)}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <MCIcon name={program.icon} size={28} color={colors.primary} />
                </View>

                <View style={styles.programInfo}>
                  <Text style={styles.programTitle}>{program.title}</Text>
                  {program.subtitle ? (
                    <Text style={styles.programSubtitle}>{program.subtitle}</Text>
                  ) : null}

                  {program.duration ? (
                    <View style={styles.metaRow}>
                      <MCIcon name="clock-outline" size={12} color={colors.textMuted} />
                      <Text style={styles.metaDuration}> {program.duration}</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity style={styles.playBtn} activeOpacity={0.8} onPress={() => handleProgram(program)}>
                  <MCIcon name="play" size={14} color={colors.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default WellnessScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // The hero card itself comes from <TabHeader/>; the stats strip below is
  // passed to it as children. Accent-purple is kept as a fixed brand banner
  // across light/dark, hence COLORS rather than the themed palette.
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
  },
  statBox:   { flex: 1, alignItems: 'center', gap: SPACING.xs },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  section:    { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryFaint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  popularText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  programInfo:     { flex: 1 },
  programTitle:    { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  programSubtitle: { fontSize: 12, color: colors.primary, marginBottom: SPACING.sm },
  metaRow:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  metaDuration:    { fontSize: 12, color: colors.textMuted },
  levelBadge:      { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.pill },
  levelText:       { fontSize: 11, fontWeight: '600' },
  metaCompleted:   { fontSize: 12, color: colors.textMuted },

  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },

  errorBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: SPACING.sm,
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  errorText:  { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
