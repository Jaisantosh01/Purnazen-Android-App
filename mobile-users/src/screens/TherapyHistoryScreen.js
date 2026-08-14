import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import therapyService from '../services/therapyService';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppDialog from '../components/AppDialog';
import PainScale from '../components/PainScale';


const TherapyHistoryScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sessions, setSessions] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completingSessionId, setCompletingSessionId] = useState(null);
  // Wellness programmes aren't pain-relief routines, so they only collect a
  // written note — the pain score stays for relief/acupressure sessions.
  const [asksPain, setAsksPain] = useState(true);
  const [painAfter, setPainAfter] = useState(5);
  const [completeFeedback, setCompleteFeedback] = useState('');
  const [savingComplete, setSavingComplete] = useState(false);

  const fetchSessions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const [groupData, historyData] = await Promise.all([
        therapyService.getSessionGroups(),
        therapyService.getTherapyHistory(),
      ]);
      setSessions(groupData?.sessions ?? []);
      setStats(historyData?.stats ?? null);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const totalSessions = sessions?.length ?? 0;
  const totalMinutes = stats?.minutes ?? 0;

  const handleContinue = (session) => {
    navigation.navigate('VideoPlayer', {
      groupId: session.groupId,
      sessionGroupId: session.id,
      // Carry the type through so a resumed relief run keeps saving as relief
      // and still closes on a pain score rather than a wellness remark.
      sessionType: session.sessionType,
    });
  };

  const handleComplete = (session) => {
    setCompletingSessionId(session.id);
    setAsksPain(session.sessionType !== 'wellness');
    setPainAfter(5);
    setCompleteFeedback('');
    setShowCompleteDialog(true);
  };

  const handleSaveCompleteFeedback = async () => {
    if (!completingSessionId) return;
    setSavingComplete(true);
    try {
      await therapyService.completeSession(
        completingSessionId,
        asksPain ? Math.min(10, Math.max(0, painAfter)) : null,
        completeFeedback.trim() || null,
      );
      setShowCompleteDialog(false);
      setCompletingSessionId(null);
      fetchSessions(true);
    } catch {} finally {
      setSavingComplete(false);
    }
  };

  const handleSkipCompleteFeedback = () => {
    setShowCompleteDialog(false);
    setCompletingSessionId(null);
  };

  // 'relief' is what a Quick Relief run is stored as — spell it out in full so
  // the card reads "Quick Relief Session", matching where the user started it.
  const sessionTypeLabel = (type) => {
    const map = {
      wellness: 'Wellness',
      relief: 'Quick Relief',
      yoga: 'Yoga',
      meditation: 'Meditation',
      breathing: 'Breathing',
      acupressure: 'Acupressure',
    };
    return map[type] || type;
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Therapy History" variant="light" backBehavior="popToRoot" />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Loading sessions...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>Failed to load history</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSessions} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchSessions(true)} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <MCIcon name="playlist-check" size={17} color={colors.primary} />
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <MCIcon name="timer-outline" size={17} color={colors.primary} />
            <Text style={styles.statValue}>{totalMinutes}</Text>
            <Text style={styles.statLabel}>Est. Minutes</Text>
          </View>
        </View>

        {(!sessions || sessions.length === 0) ? (
          <View style={styles.emptyState}>
            <MCIcon name="clipboard-text-outline" size={48} color={colors.textMuted} />
            <Text style={styles.stateTitle}>No sessions yet</Text>
            <Text style={styles.stateText}>
              Start a therapy session and it will show up here.
            </Text>
          </View>
        ) : (
        <View style={styles.sessionList}>
          {sessions.map((session) => {
            const isInProgress = session.status === 'in_progress';
            const progress = session.totalVideos > 0
              ? Math.round((session.completedVideos / session.totalVideos) * 100)
              : 0;
            const fb = session.feedback;

            return (
              <View key={session.id} style={[styles.sessionCard, { backgroundColor: colors.card }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.sessionType}>{sessionTypeLabel(session.sessionType)} Session</Text>
                    <Text style={styles.sessionDate}>
                      {session.createdAt
                        ? new Date(session.createdAt).toLocaleDateString([], {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })
                        : ''}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    isInProgress ? styles.statusInProgress : styles.statusCompleted,
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: isInProgress ? colors.warning : colors.primary },
                    ]}>
                      {isInProgress ? 'In Progress' : 'Completed'}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressRow}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {session.completedVideos}/{session.totalVideos} videos
                  </Text>
                </View>

                {fb && (fb.painBefore != null || fb.painAfter != null) && (
                  <View style={styles.feedbackRow}>
                    {fb.painBefore != null && (
                      <Text style={styles.feedbackText}>
                        Pain before: {fb.painBefore}/10
                      </Text>
                    )}
                    {fb.painAfter != null && (
                      <Text style={styles.feedbackTextRight}>
                        Pain after: {fb.painAfter}/10
                      </Text>
                    )}
                  </View>
                )}

                {/* The remark the user left in the end-of-session popup. Absent
                    for sessions where they skipped it, so the block is dropped
                    entirely rather than showing an empty quote. */}
                {fb?.userFeedback?.trim() ? (
                  <View style={styles.noteCard}>
                    <MCIcon name="comment-quote-outline" size={14} color={colors.primary} />
                    <View style={styles.noteTextCol}>
                      <Text style={styles.noteLabel}>Your feedback</Text>
                      <Text style={styles.noteText}>{fb.userFeedback.trim()}</Text>
                    </View>
                  </View>
                ) : null}

                {/* Replies left against this session by the treating doctor or
                    an admin, so the user sees the response in the same place. */}
                {fb?.doctorFeedback?.trim() ? (
                  <View style={[styles.noteCard, styles.noteCardResponse]}>
                    <MCIcon name="stethoscope" size={14} color={colors.primary} />
                    <View style={styles.noteTextCol}>
                      <Text style={styles.noteLabel}>Doctor's response</Text>
                      <Text style={styles.noteText}>{fb.doctorFeedback.trim()}</Text>
                    </View>
                  </View>
                ) : null}

                {isInProgress && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.continueBtn}
                      onPress={() => handleContinue(session)}
                      activeOpacity={0.85}
                    >
                      <MCIcon name="play" size={16} color={colors.white} />
                      <Text style={styles.continueText}>Continue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.completeBtn}
                      onPress={() => handleComplete(session)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.completeText}>Mark Complete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        )}
      </ScrollView>
      )}

      <AppDialog
        visible={showCompleteDialog}
        onClose={handleSkipCompleteFeedback}
        onConfirm={handleSaveCompleteFeedback}
        confirmLabel="Save"
        cancelLabel="Skip"
        confirmLoading={savingComplete}
        icon="clipboard-text-outline"
        title="Session Feedback"
        subtitle={asksPain ? 'How severe is your pain now?' : 'How did this session go?'}
      >
        {asksPain && <PainScale value={painAfter} onChange={setPainAfter} label="Pain after" />}
        <TextInput
          style={styles.feedbackInput}
          placeholder="Write your feedback here…"
          placeholderTextColor={colors.textMuted}
          value={completeFeedback}
          onChangeText={setCompleteFeedback}
          multiline
          maxLength={1000}
        />
      </AppDialog>
    </View>
  );
};

export default TherapyHistoryScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primaryLight },

  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 8,
  },
  emptyState: {
    alignItems: 'center', paddingHorizontal: 32, paddingVertical: 48, gap: 12,
  },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  stateText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 14, marginTop: 12,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: colors.white },

  // One compact strip rather than two tall stacked tiles — the old layout burned
  // ~100px of vertical space on two numbers. Kept tight to the header and the
  // list: the numbers are a glance, not the point of the screen.
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 8, marginBottom: 0,
    backgroundColor: colors.card, borderRadius: 12, paddingVertical: 7,
    elevation: 2, shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  statBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border },
  statValue: { fontSize: 16, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textSecondary },

  sessionList: { paddingHorizontal: 16, marginTop: 8 },
  sessionCard: {
    padding: 16, borderRadius: 14, marginBottom: 16,
    elevation: 2, shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  cardHeaderLeft: {},
  sessionType: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sessionDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  statusInProgress: { backgroundColor: colors.warning + '20' },
  statusCompleted: { backgroundColor: colors.primaryLight },
  statusText: { fontSize: 12, fontWeight: '700' },

  progressRow: { marginBottom: 8 },
  progressBarBg: {
    height: 6, borderRadius: 3, backgroundColor: colors.surfaceMuted, marginBottom: 4,
  },
  progressBarFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  progressLabel: { fontSize: 12, color: colors.textMuted },

  feedbackRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8,
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: colors.surfaceMuted, borderRadius: 8,
  },
  feedbackText: { fontSize: 12, color: colors.textPrimary },
  feedbackTextRight: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },

  noteCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8,
    backgroundColor: colors.primaryLight, borderRadius: 8,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  noteCardResponse: { backgroundColor: colors.surfaceMuted },
  noteTextCol: { flex: 1 },
  noteLabel: {
    fontSize: 10.5, fontWeight: '800', color: colors.textMuted,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2,
  },
  noteText: { fontSize: 12.5, color: colors.textPrimary, lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 12, flex: 1, justifyContent: 'center',
  },
  continueText: { fontSize: 14, fontWeight: '700', color: colors.white },
  completeBtn: {
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  completeText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  feedbackInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.surfaceMuted, minHeight: 80, textAlignVertical: 'top' },
});
