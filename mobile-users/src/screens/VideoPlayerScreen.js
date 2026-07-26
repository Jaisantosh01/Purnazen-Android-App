import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { syncVideoProgress } from '../utils/videoTracker';
import therapyService from '../services/therapyService';
import VideoPlayer from '../components/VideoPlayer';
import AppDialog from '../components/AppDialog';
import PainScale from '../components/PainScale';
import AppToggle from '../components/AppToggle';

const AUTOPLAY_NEXT_KEY = 'video_autoplay_next';

const VideoPlayerScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { groupId, sessionGroupId: routeSessionGroupId } = route.params;

  const [sessionGroupId, setSessionGroupId] = useState(routeSessionGroupId || null);
  const [incompleteSession, setIncompleteSession] = useState(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [sessionDialogResolved, setSessionDialogResolved] = useState(!!routeSessionGroupId);

  const [catalog, setCatalog] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [autoPlayNext, setAutoPlayNext] = useState(true);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [userFeedback, setUserFeedback] = useState('');
  const [painAfter, setPainAfter] = useState(null);
  const [painBefore, setPainBefore] = useState(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackId, setFeedbackId] = useState(null);

  const watchedRef = useRef(0);
  const feedbackShownRef = useRef(false);

  // Asked once the *whole* group has played out. Called from onEnd alone (a
  // video crossing 90% used to trigger it, which popped the dialog over the
  // still-playing last video). When the run started from Quick Relief the chat
  // assistant already stored a painBefore baseline, so the prompt closes the
  // pair by asking for painAfter; otherwise it is just the written note.
  const maybeAskForFeedback = useCallback(async () => {
    if (feedbackShownRef.current) return;

    const totalVideos = catalog?.videos?.length;
    if (!totalVideos) return;

    let completedCount;
    try {
      const countRes = await apiClient.get(ENDPOINTS.THERAPY_HISTORY_COMPLETED_COUNT(groupId));
      completedCount = countRes?.data?.completedCount ?? 0;
    } catch {
      return; // can't confirm the group is finished — don't interrupt
    }
    if (completedCount < totalVideos) return;

    feedbackShownRef.current = true;

    let record = null;
    try {
      const feedbackRes = await apiClient.get(ENDPOINTS.THERAPY_FEEDBACK_BY_SESSION(sessionGroupId));
      record = feedbackRes?.data || null;
    } catch {
      // No record tied to this session group. The pre-session baseline the chat
      // assistant writes has no sessionGroupId, so fall back to the newest open
      // record for this group and finish that one instead of starting a second.
      try {
        const byGroup = await apiClient.get(ENDPOINTS.THERAPY_FEEDBACK_BY_GROUP(groupId));
        record = (byGroup?.data || []).find(f => f.painAfter == null) || null;
      } catch {
        record = null;
      }
    }

    setFeedbackId(record?.id || null);
    setPainBefore(typeof record?.painBefore === 'number' ? record.painBefore : null);
    setPainAfter(null);
    setUserFeedback('');
    setShowFeedbackModal(true);
  }, [catalog, groupId, sessionGroupId]);

  const handleSkipFeedback = useCallback(() => {
    setShowFeedbackModal(false);
  }, []);

  const handleSaveFeedback = useCallback(async () => {
    setSavingFeedback(true);
    try {
      const payload = {
        userFeedback: userFeedback.trim() || null,
        // Left out when the user didn't pick a score; the field is optional.
        painAfter: typeof painAfter === 'number' ? painAfter : null,
      };

      let fbId = feedbackId;

      if (!fbId) {
        const created = await apiClient.post(ENDPOINTS.THERAPY_FEEDBACK, {
          videoGroupId: groupId,
          sessionType: 'wellness',
          sessionGroupId,
        });
        fbId = created?.data?.id;
      }
      if (fbId) {
        await apiClient.put(ENDPOINTS.THERAPY_FEEDBACK_PAIN_AFTER(fbId), payload);
      }
    } catch {
      // continue even if save fails
    } finally {
      setSavingFeedback(false);
      setShowFeedbackModal(false);
    }
  }, [feedbackId, userFeedback, painAfter, groupId, sessionGroupId]);

  const handleContinueSession = useCallback(() => {
    if (incompleteSession) {
      setSessionGroupId(incompleteSession.id);
      setSessionDialogResolved(true);
      setShowSessionDialog(false);
    }
  }, [incompleteSession]);

  const handleStartFreshSession = useCallback(async () => {
    setShowSessionDialog(false);
    try {
      const sg = await therapyService.startSession(groupId, 'wellness');
      if (sg?.id) {
        setSessionGroupId(sg.id);
        setSessionDialogResolved(true);
      }
    } catch {
      setSessionDialogResolved(true);
    }
  }, [groupId]);

  useEffect(() => {
    AsyncStorage.getItem(AUTOPLAY_NEXT_KEY)
      .then(stored => { if (stored === '0') setAutoPlayNext(false); })
      .catch(() => {});
  }, []);

  const handleAutoPlayNextChange = useCallback(next => {
    setAutoPlayNext(next);
    AsyncStorage.setItem(AUTOPLAY_NEXT_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId))
      .then(res => setCatalog(res.data))
      .catch(err => setError(err.message || 'Failed to load video catalog'))
      .finally(() => setLoading(false));
  }, [groupId]);

  // Mark the first video as started once the catalog is in.
  useEffect(() => {
    if (catalog?.videos?.length && sessionGroupId) {
      syncVideoProgress(groupId, catalog.videos[0].id, 'Pending', 0, 'wellness', null, null, sessionGroupId);
    }
  }, [catalog, groupId, sessionGroupId]);

  // Check for existing feedback or incomplete session on mount.
  useEffect(() => {
    if (!catalog || sessionDialogResolved) return;

    if (sessionGroupId) {
      apiClient.get(ENDPOINTS.THERAPY_FEEDBACK_BY_SESSION(sessionGroupId))
        .then(res => {
          if (res?.data?.id) setFeedbackId(res.data.id);
          setSessionDialogResolved(true);
        })
        .catch(() => {
          setSessionDialogResolved(true);
        });
    } else {
      therapyService.getIncompleteSession(groupId).then(sg => {
        if (sg) {
          setIncompleteSession(sg);
          setShowSessionDialog(true);
        } else {
          therapyService.startSession(groupId, 'wellness').then(fresh => {
            if (fresh?.id) setSessionGroupId(fresh.id);
            setSessionDialogResolved(true);
          }).catch(() => setSessionDialogResolved(true));
        }
      }).catch(() => setSessionDialogResolved(true));
    }
  }, [catalog, groupId, sessionGroupId, sessionDialogResolved]);

  const onProgress = useCallback(
    async data => {
      const video = catalog?.videos?.[currentVideoIndex];
      if (!video) return;
      const dur = video.duration || data.seekableDuration || 0;
      const watched = data.currentTime;
      // Fire "Completed" once when crossing 90%. The feedback prompt is NOT
      // raised here — it belongs to onEnd, once the last video really finishes.
      if (dur > 0 && watched / dur > 0.9 && watchedRef.current / dur <= 0.9) {
        await syncVideoProgress(groupId, video.id, 'Completed', dur / 60, 'wellness', null, null, sessionGroupId);
      }
      watchedRef.current = watched;
    },
    [catalog, currentVideoIndex, groupId, sessionGroupId],
  );

  // Switch to a playlist item. `completedPrev` marks the outgoing video done
  // (used when the current video reached its end) instead of leaving it pending.
  const goToVideo = useCallback(
    (index, completedPrev = false) => {
      if (!catalog?.videos?.[index]) return;
      const prev = catalog.videos[currentVideoIndex];
      if (prev) {
        syncVideoProgress(
          groupId,
          prev.id,
          completedPrev ? 'Completed' : 'Pending',
          (completedPrev ? prev.duration : watchedRef.current) / 60,
          'wellness',
          null, null, sessionGroupId,
        );
      }
      watchedRef.current = 0;
      setCurrentVideoIndex(index);
      syncVideoProgress(groupId, catalog.videos[index].id, 'Pending', 0, 'wellness', null, null, sessionGroupId);
    },
    [catalog, currentVideoIndex, groupId, sessionGroupId],
  );

  const handleEnd = useCallback(async () => {
    const video = catalog?.videos?.[currentVideoIndex];
    if (video) {
      await syncVideoProgress(groupId, video.id, 'Completed', video.duration / 60, 'wellness', null, null, sessionGroupId);
      maybeAskForFeedback();
    }
  }, [catalog, currentVideoIndex, groupId, sessionGroupId, maybeAskForFeedback]);

  const hasNext = !!catalog && currentVideoIndex < catalog.videos.length - 1;
  const goNext = useCallback(() => {
    if (hasNext) goToVideo(currentVideoIndex + 1, true);
  }, [hasNext, currentVideoIndex, goToVideo]);

  if (loading) {
    // Skeleton mirrors the loaded layout (dark player frame on top, info +
    // playlist below) so the page doesn't flash from a light spinner page to
    // the dark player once the catalog arrives.
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={{ height: insets.top, backgroundColor: '#000' }} />
        <View style={[styles.playerSkeleton, { height: (screenW * 9) / 16 }]}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.floatingBack, { top: insets.top + 8 }]}
          hitSlop={hit}
        >
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.skeletonBody}>
          <View style={[styles.skelLine, { width: '38%', height: 10 }]} />
          <View style={[styles.skelLine, { width: '72%', height: 18, marginTop: 12 }]} />
          <View style={[styles.skelLine, { width: '54%', height: 12, marginTop: 10, marginBottom: 22 }]} />
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.skelRow}>
              <View style={styles.skelCircle} />
              <View style={{ flex: 1 }}>
                <View style={[styles.skelLine, { width: '64%', height: 12 }]} />
                <View style={[styles.skelLine, { width: '28%', height: 10, marginTop: 8 }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error || !catalog || !catalog.videos.length) {
    return (
      <View style={styles.center}>
        <MCIcon name="alert-circle-outline" size={60} color={colors.danger} />
        <Text style={styles.errorText}>{error || 'No videos found in this group'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentVideo = catalog.videos[currentVideoIndex];
  const nextVideo = catalog.videos[currentVideoIndex + 1];

  return (
    <View style={styles.root}>
      {/* Translucent bar lets the player run edge-to-edge under the status bar
          for a larger, more immersive frame. */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Black filler behind the status bar. Kept as a sibling (not a wrapper)
          so the player stays a direct child of root and its JS fullscreen can
          expand to cover the whole screen. */}
      <View style={{ height: insets.top, backgroundColor: '#000' }} />

      {/* Player */}
      <VideoPlayer
        source={currentVideo.videoUrl ? { uri: currentVideo.videoUrl } : null}
        sourceId={currentVideo.id}
        poster={
          <MCIcon name={currentVideo.icon || 'play-circle-outline'} size={80} color={colors.primary} />
        }
        onProgress={onProgress}
        onEnd={handleEnd}
        onNext={goNext}
        hasNext={hasNext}
        nextTitle={nextVideo?.title}
        nextSubtitle={nextVideo ? `${Math.floor(nextVideo.duration / 60)} min` : null}
        autoPlayNext={autoPlayNext}
        // Don't count down (or advance) behind the session-feedback dialog.
        suspendUpNext={showFeedbackModal}
      />

      {/* Floating back button over the player */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.floatingBack, { top: insets.top + 8 }]}
        hitSlop={hit}
      >
        <MCIcon name="arrow-left" size={22} color="#fff" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Current video info */}
        <View style={styles.currentInfoCard}>
          <Text style={styles.groupLabel}>{catalog.title}</Text>
          <Text style={styles.videoTitle}>{currentVideo.title}</Text>
          {currentVideo.description ? (
            <Text style={styles.videoDescription}>{currentVideo.description}</Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <MCIcon name="clock-outline" size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{Math.floor(currentVideo.duration / 60)} min</Text>
            </View>
            <View style={styles.metaChip}>
              <MCIcon name="playlist-play" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>
                {currentVideoIndex + 1} of {catalog.videos.length}
              </Text>
            </View>
          </View>

          {/* Autoplay — only meaningful when the group has more than one video */}
          {catalog.videos.length > 1 && (
            <View style={styles.autoPlayRow}>
              <View style={styles.autoPlayIcon}>
                <MCIcon name="play-speed" size={18} color={colors.primary} />
              </View>
              <View style={styles.autoPlayInfo}>
                <Text style={styles.autoPlayTitle}>Autoplay next session</Text>
                <Text style={styles.autoPlaySubtitle}>
                  {autoPlayNext
                    ? 'Starts the next video 5 seconds after this one ends'
                    : 'Asks before starting the next video'}
                </Text>
              </View>
              <AppToggle value={autoPlayNext} onValueChange={handleAutoPlayNextChange} />
            </View>
          )}
        </View>

        {/* Playlist */}
        <View style={styles.playlistSection}>
          <Text style={styles.sectionLabel}>SESSIONS IN THIS GROUP</Text>
          {catalog.videos.map((video, index) => {
            const isActive = index === currentVideoIndex;
            return (
              <TouchableOpacity
                key={video.id}
                style={[styles.videoRow, isActive && styles.videoRowActive]}
                onPress={() => goToVideo(index)}
                activeOpacity={0.8}
              >
                <View style={[styles.rowNumberCircle, isActive && styles.rowNumberActive]}>
                  {isActive ? (
                    <MCIcon name="play" size={14} color={colors.white} />
                  ) : (
                    <Text style={styles.rowNumberText}>{index + 1}</Text>
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, isActive && styles.rowTitleActive]} numberOfLines={1}>
                    {video.title}
                  </Text>
                  <Text style={styles.rowDuration}>{Math.floor(video.duration / 60)} min</Text>
                </View>
                <MCIcon name={isActive ? 'equalizer' : 'chevron-right'} size={20} color={isActive ? colors.primary : colors.borderStrong} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {showSessionDialog && (
        <View style={styles.sessionDialogOverlay}>
          <View style={[styles.sessionDialog, { backgroundColor: colors.card }]}>
            <Text style={styles.sessionDialogTitle}>Resume Session?</Text>
            <Text style={styles.sessionDialogSub}>
              You have an incomplete session from{' '}
              {incompleteSession?.createdAt
                ? new Date(incompleteSession.createdAt).toLocaleDateString()
                : 'earlier'}
              .{'\n'}{incompleteSession?.completedVideos ?? 0}/{incompleteSession?.totalVideos ?? 0} videos completed.
            </Text>
            <View style={styles.sessionDialogActions}>
              <TouchableOpacity
                style={[styles.sessionDialogBtn, { backgroundColor: colors.primary }]}
                onPress={handleContinueSession}
                activeOpacity={0.85}
              >
                <Text style={[styles.sessionDialogBtnText, { color: colors.white }]}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sessionDialogBtn, { backgroundColor: colors.surfaceMuted }]}
                onPress={handleStartFreshSession}
                activeOpacity={0.85}
              >
                <Text style={[styles.sessionDialogBtnText, { color: colors.textPrimary }]}>Start Fresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <AppDialog
        visible={showFeedbackModal}
        onClose={handleSkipFeedback}
        onConfirm={handleSaveFeedback}
        confirmLabel="Save"
        cancelLabel="Skip"
        confirmLoading={savingFeedback}
        icon="clipboard-text-outline"
        title="Session Complete"
        subtitle="You finished every video in this group. How did it go?"
      >
        {painBefore != null && (
          <Text style={styles.painBeforeNote}>
            You started this session at {painBefore}/10.
          </Text>
        )}
        <PainScale value={painAfter} onChange={setPainAfter} label="Pain now" />
        <TextInput
          style={styles.feedbackInput}
          placeholder="Write your feedback here…"
          placeholderTextColor={colors.textMuted}
          value={userFeedback}
          onChangeText={setUserFeedback}
          multiline
          maxLength={1000}
        />
      </AppDialog>
    </View>
  );
};

export default VideoPlayerScreen;

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.background },

  // Loading skeleton — same silhouette as the loaded page
  playerSkeleton: {
    width: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonBody: { padding: 20 },
  skelLine: { borderRadius: 6, backgroundColor: colors.surfaceMuted },
  skelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  skelCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    marginRight: 12,
  },

  floatingBack: {
    position: 'absolute',
    top: 14,
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },

  currentInfoCard: {
    backgroundColor: colors.card,
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  videoTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  videoDescription: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  metaText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  autoPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  autoPlayIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  autoPlayInfo: { flex: 1 },
  autoPlayTitle: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  autoPlaySubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },

  playlistSection: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 16 },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  videoRowActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  rowNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowNumberActive: { backgroundColor: colors.primary },
  rowNumberText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowTitleActive: { color: colors.primary },
  rowDuration: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  painBeforeNote: { fontSize: 12.5, color: colors.textMuted, marginBottom: 10 },
  feedbackInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: { fontSize: 16, color: colors.textSecondary, marginTop: 16, marginBottom: 24, textAlign: 'center' },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  backBtnText: { color: colors.white, fontWeight: '700' },

  sessionDialogOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  sessionDialog: {
    width: '80%',
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  sessionDialogTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  sessionDialogSub: { fontSize: 14, color: colors.textSecondary, marginBottom: 20, textAlign: 'center', lineHeight: 20 },
  sessionDialogActions: { flexDirection: 'row', gap: 12 },
  sessionDialogBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
  },
  sessionDialogBtnText: { fontSize: 15, fontWeight: '700' },
});
