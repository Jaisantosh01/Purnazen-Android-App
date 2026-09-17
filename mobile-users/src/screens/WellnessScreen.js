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
import therapyService from '../services/therapyService';
import { GridCardSkeleton, StatsSkeleton } from '../components/SkeletonLoader';
import TabHeader from '../components/TabHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { reliefCardColors } from '../utils/cardTheme';
import dayStreak from '../utils/streak';

// Wellness programs carry no colour of their own (relief cards do), so the
// grid cycles through a calm set; reliefCardColors composites them for dark.
const HUES = [
  { bg: '#EEE9FF', fg: '#6D4AFF' },
  { bg: '#E6F7EF', fg: '#0E9F6E' },
  { bg: '#FFEFE6', fg: '#E8702A' },
  { bg: '#E6F2FF', fg: '#2B7BD6' },
];

// A time-of-day pick for the hero when nothing is in progress: "Morning …"
// before noon, "Evening …" after five, otherwise the first program.
const todaysPick = (programs, hour = new Date().getHours()) => {
  const word = hour < 12 ? 'morning' : hour >= 17 ? 'evening' : null;
  return (word && programs.find(p => p.title.toLowerCase().includes(word))) || programs[0] || null;
};

const WellnessScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [programs, setPrograms]     = useState([]);
  const [runs, setRuns]             = useState([]);   // the user's session groups, newest first
  const [stats, setStats]           = useState(null);
  const [isLoading, setIsLoading]   = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError]           = useState(null);

  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      // History is a nice-to-have: a failure there must not blank the catalog.
      const [data, groups, history] = await Promise.all([
        wellnessService.getAllSessions(),
        therapyService.getSessionGroups(1, 50).catch(() => null),
        therapyService.getTherapyHistory().catch(() => null),
      ]);
      setPrograms(data?.sessions || []);
      setRuns(groups?.sessions || []);
      setStats(history?.stats || null);
    } catch (err) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Per-program progress from the user's runs. ponytail: reads the 50 newest
  // runs, so "done ×N" caps there — a per-group count endpoint if it matters.
  const progress = useMemo(() => {
    const byGroup = {};
    for (const r of runs) {
      const p = (byGroup[r.groupId] ||= { done: 0, open: null });
      if (r.status === 'completed') p.done += 1;
      else if (!p.open) p.open = r; // newest first, so the first open run wins
    }
    return byGroup;
  }, [runs]);

  const streak = useMemo(() => dayStreak(runs.map(r => r.createdAt)), [runs]);

  // "Pick up where you left off" — the newest unfinished wellness run.
  const resume = useMemo(() => {
    const run = runs.find(r => r.status !== 'completed' && r.sessionType === 'wellness');
    const program = run && programs.find(p => p.videoGroupId === run.groupId);
    return program ? { run, program } : null;
  }, [runs, programs]);
  const pick = !resume && !isLoading ? todaysPick(programs.filter(p => p.videoGroupId)) : null;

  const play = (program, run = null) => {
    if (!program.videoGroupId) {
      showAlert('Coming soon', 'Sessions for this program are being added. Please check back shortly.');
      return;
    }
    navigation.navigate('VideoPlayer', {
      groupId: program.videoGroupId,
      groupTitle: program.title,
      // Filed as a wellness session: the end-of-session prompt asks for a
      // remark only, no pain score.
      sessionType: 'wellness',
      ...(run ? { sessionGroupId: run.id } : {}),
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            colors={[COLORS.accent]}
            tintColor={COLORS.accent}
          />
        }
      >
        <TabHeader
          title="Wellness"
          subtitle="Daily routines for a healthier you"
          background={COLORS.accent}
        >
          {isLoading ? (
            <StatsSkeleton />
          ) : (
            <View style={styles.statsRow}>
              {[
                { icon: 'check-decagram-outline', value: stats?.sessions ?? 0, label: 'Sessions' },
                { icon: 'timer-outline',          value: stats?.minutes ?? 0,  label: 'Minutes' },
                { icon: 'fire',                   value: streak,               label: 'Day streak' },
              ].map((stat, i, arr) => (
                <View key={stat.label} style={[styles.statBox, i < arr.length - 1 && styles.statBorder]}>
                  <MCIcon name={stat.icon} size={22} color={COLORS.white} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>
          )}
        </TabHeader>

        {/* Hero: pick up an unfinished run, else a suggestion for right now */}
        {(resume || pick) && (
          <TouchableOpacity
            style={styles.resumeCard}
            activeOpacity={0.9}
            onPress={() => (resume ? play(resume.program, resume.run) : play(pick))}
          >
            <View style={styles.resumeTop}>
              <View style={styles.resumeIcon}>
                <MCIcon name={(resume ? resume.program : pick).icon || 'star-four-points-outline'} size={22} color={COLORS.white} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.resumeLabel}>{resume ? 'CONTINUE' : "TODAY'S PICK"}</Text>
                <Text style={styles.resumeTitle} numberOfLines={1}>{(resume ? resume.program : pick).title}</Text>
              </View>
              <View style={styles.resumeBtn}>
                <MCIcon name="play" size={16} color={COLORS.accent} />
                <Text style={styles.resumeBtnText}>{resume ? 'Resume' : 'Start'}</Text>
              </View>
            </View>
            {resume ? (
              <>
                <ProgressBar done={resume.run.completedVideos} total={resume.run.totalVideos} styles={styles} light />
                <Text style={styles.resumeMeta}>
                  {resume.run.completedVideos ?? 0} of {resume.run.totalVideos ?? 0} videos done
                </Text>
              </>
            ) : (
              <Text style={styles.resumeMeta}>{pick.duration} · a good fit for this time of day</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Programs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Programs</Text>
            {!isLoading && !error && programs.length > 0 && (
              <Text style={styles.sectionCount}>{programs.length}</Text>
            )}
          </View>

          {isLoading ? (
            <View style={styles.grid}>{[1, 2, 3, 4].map(i => <GridCardSkeleton key={i} />)}</View>
          ) : error ? (
            <View style={styles.emptyBox}>
              <MCIcon name="alert-circle-outline" size={40} color={colors.danger} />
              <Text style={styles.emptyTitle}>Failed to load programs</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} activeOpacity={0.85}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : programs.length === 0 ? (
            <View style={styles.emptyBox}>
              <MCIcon name="yoga" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>No programs yet</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {programs.map((program, i) => {
                const { done = 0, open = null } = progress[program.videoGroupId] || {};
                const card = reliefCardColors({ ...HUES[i % HUES.length], colors, isDark });
                const ready = !!program.videoGroupId;
                return (
                  <TouchableOpacity
                    key={program.id}
                    style={[styles.programCard, { backgroundColor: card.background }, !ready && styles.programCardSoon]}
                    activeOpacity={0.85}
                    onPress={() => play(program, open)}
                  >
                    <View style={styles.programTop}>
                      <MCIcon name={program.icon || 'star-four-points-outline'} size={30} color={card.accent} />
                      {done > 0 && (
                        <View style={[styles.doneChip, { backgroundColor: card.accent }]}>
                          <MCIcon name="check" size={11} color={COLORS.white} />
                          <Text style={styles.doneChipText}>{done > 1 ? `×${done}` : 'Done'}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={[styles.programTitle, { color: card.title }]} numberOfLines={2}>{program.title}</Text>
                    <Text style={[styles.programMeta, { color: card.subtitle }]}>
                      {ready ? program.duration : 'Coming soon'}
                    </Text>

                    {open ? (
                      <View style={styles.programProgress}>
                        <ProgressBar done={open.completedVideos} total={open.totalVideos} styles={styles} accent={card.accent} />
                        <Text style={[styles.programMeta, { color: card.accent }]}>
                          {open.completedVideos ?? 0}/{open.totalVideos ?? 0}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.programFooter}>
                        <Text style={[styles.programCta, { color: card.accent }]}>{ready ? 'Start' : 'Soon'}</Text>
                        <MCIcon name={ready ? 'arrow-right' : 'clock-outline'} size={16} color={card.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default WellnessScreen;

const ProgressBar = ({ done = 0, total = 0, styles, light = false, accent }) => (
  <View style={[styles.track, light && styles.trackLight]}>
    <View
      style={[
        styles.fill,
        light && styles.fillLight,
        accent && { backgroundColor: accent },
        { width: `${total > 0 ? Math.min(100, (done / total) * 100) : 0}%` },
      ]}
    />
  </View>
);

const makeStyles = colors => StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 30 },
  flex:   { flex: 1 },

  // The hero card itself comes from <TabHeader/>; the stats strip is passed in
  // as children. Accent-purple is a fixed brand banner across light/dark,
  // hence COLORS rather than the themed palette.
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  statBox:    { flex: 1, alignItems: 'center', gap: 2 },
  statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' },
  statValue:  { fontSize: 20, fontWeight: '800', color: COLORS.white, fontVariant: ['tabular-nums'] },
  statLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  resumeCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent,
    gap: SPACING.sm,
  },
  resumeTop:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  resumeIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.75)' },
  resumeTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  resumeBtnText: { fontSize: 13, fontWeight: '800', color: COLORS.accent },
  resumeMeta:    { fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  section:       { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 14 },
  sectionTitle:  { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primaryFaint,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  programCard: {
    width: '48%',
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: 14,
    minHeight: 160,
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  programCardSoon: { opacity: 0.6 },
  programTop:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.sm },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  doneChipText:    { fontSize: 10, fontWeight: '800', color: COLORS.white },
  programTitle:    { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  programMeta:     { fontSize: 12, fontVariant: ['tabular-nums'] },
  programProgress: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  programFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  programCta:      { fontSize: 12, fontWeight: '700' },

  track:      { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden', flex: 1 },
  trackLight: { backgroundColor: 'rgba(255,255,255,0.25)' },
  fill:       { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  fillLight:  { backgroundColor: COLORS.white },

  emptyBox:   { alignItems: 'center', paddingVertical: 48, gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emptyText:  { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
