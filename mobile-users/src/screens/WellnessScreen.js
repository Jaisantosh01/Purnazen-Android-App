import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import wellnessService from '../services/wellnessService';
import { ProgramSkeleton, StatsSkeleton } from '../components/SkeletonLoader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const LEVEL_COLORS = {
  'Beginner':     { bg: '#e8f5e9', text: '#2e7d32' },
  'All levels':   { bg: '#e3f2fd', text: '#1565c0' },
  'Intermediate': { bg: '#fff3e0', text: '#e65100' },
};

const ICON_MAP = {
  YogaSession:           { icon: 'yoga',           color: COLORS.accent,     bg: COLORS.accentLight },
  MeditationSession:     { icon: 'meditation',      color: COLORS.primary,    bg: COLORS.primaryLight },
  BreathingSession:      { icon: 'weather-windy',   color: '#0284c7',         bg: '#E0F2FE' },
  MorningRoutineSession: { icon: 'weather-sunny',   color: COLORS.warning,    bg: '#FFFBEB' },
  EveningWindDown:       { icon: 'weather-night',   color: COLORS.accent,     bg: COLORS.accentLight },
  FullBodyStretch:       { icon: 'human-handsup',   color: '#ea580c',         bg: '#FFF3E0' },
};

const WellnessScreen = ({ navigation }) => {
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
        iconColor: COLORS.primary,
        iconBg:    COLORS.primaryLight,
        duration:  s.duration,
        level:     'All levels',
        completed: 0,
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
        groupTitle: program.title
      });
    } else {
      Alert.alert(
        "Navigation Debug Info",
        "Program data:\n" + JSON.stringify(program, null, 2),
        [{ text: "OK" }]
      );
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.accent} />

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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wellness</Text>
          <Text style={styles.headerSubtitle}>Daily routines for a healthier you</Text>

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
        </View>

        {/* ── Programs ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Programs</Text>
            <View style={styles.popularBadge}>
              <MCIcon name="trending-up" size={13} color={COLORS.primary} />
              <Text style={styles.popularText}> Popular</Text>
            </View>
          </View>

          {isLoading ? (
            [1, 2, 3].map(i => <ProgramSkeleton key={i} />)
          ) : error ? (
            <View style={styles.errorBox}>
              <MCIcon name="alert-circle-outline" size={40} color={COLORS.danger} />
              <Text style={styles.errorTitle}>Failed to load programs</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} activeOpacity={0.85}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : programs.length === 0 ? (
            <View style={styles.errorBox}>
              <MCIcon name="yoga" size={48} color={COLORS.border} />
              <Text style={styles.errorTitle}>No programs yet</Text>
            </View>
          ) : programs.map((program) => {
            const level = LEVEL_COLORS[program.level] || { bg: COLORS.surfaceMuted, text: COLORS.textSecondary };
            return (
              <TouchableOpacity
                key={program.id}
                style={styles.programCard}
                activeOpacity={0.85}
                onPress={() => handleProgram(program)}
              >
                <View style={[styles.iconCircle, { backgroundColor: program.iconBg }]}>
                  <MCIcon name={program.icon} size={28} color={program.iconColor} />
                </View>

                <View style={styles.programInfo}>
                  <Text style={styles.programTitle}>{program.title}</Text>
                  <Text style={styles.programSubtitle}>{program.subtitle}</Text>

                  <View style={styles.metaRow}>
                    <MCIcon name="clock-outline" size={12} color={COLORS.textMuted} />
                    <Text style={styles.metaDuration}> {program.duration}</Text>
                    <View style={[styles.levelBadge, { backgroundColor: level.bg }]}>
                      <Text style={[styles.levelText, { color: level.text }]}>{program.level}</Text>
                    </View>
                    <Text style={styles.metaCompleted}>{program.completed} completed</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.playBtn} activeOpacity={0.8} onPress={() => handleProgram(program)}>
                  <MCIcon name="play" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default WellnessScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.accent,
    paddingTop: 50,
    paddingHorizontal: SPACING.xl,
    paddingBottom: 28,
    borderBottomLeftRadius: RADIUS.lg,
    borderBottomRightRadius: RADIUS.lg,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: SPACING.xl,
  },

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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryFaint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  popularText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
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
  programTitle:    { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  programSubtitle: { fontSize: 12, color: COLORS.primary, marginBottom: SPACING.sm },
  metaRow:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  metaDuration:    { fontSize: 12, color: COLORS.textMuted },
  levelBadge:      { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.pill },
  levelText:       { fontSize: 11, fontWeight: '600' },
  metaCompleted:   { fontSize: 12, color: COLORS.textMuted },

  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },

  errorBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: SPACING.sm,
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  errorText:  { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});
