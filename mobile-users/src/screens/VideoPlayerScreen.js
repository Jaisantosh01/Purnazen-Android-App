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
  Switch,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { syncVideoProgress } from '../utils/videoTracker';
import VideoPlayer from '../components/VideoPlayer';
import AppDialog from '../components/AppDialog';

// Autoplay-next preference — remembered across sessions, on by default.
const AUTOPLAY_NEXT_KEY = 'video_autoplay_next';

const VideoPlayerScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { groupId } = route.params;

  const [catalog, setCatalog] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [autoPlayNext, setAutoPlayNext] = useState(true);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [hasPainBefore, setHasPainBefore] = useState(false);
  const [painAfter, setPainAfter] = useState('5');
  const [userFeedback, setUserFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackId, setFeedbackId] = useState(null);

  const [showInitialFeedback, setShowInitialFeedback] = useState(false);
  const [painBefore, setPainBefore] = useState('5');
  const [painDescription, setPainDescription] = useState('');
  const [savingInitial, setSavingInitial] = useState(false);
  const [initialFeedbackDone, setInitialFeedbackDone] = useState(false);

  const watchedRef = useRef(0);
  const lastFeedbackVideoRef = useRef(null);
  const initialFeedbackCheckedRef = useRef(false);

  const checkAndShowFeedback = useCallback(async () => {
    const video = catalog?.videos?.[currentVideoIndex];
    if (!video) return;
    if (lastFeedbackVideoRef.current === video.id) return;

    const totalVideos = catalog?.videos?.length;
    if (!totalVideos) return;

    try {
      const countRes = await apiClient.get(ENDPOINTS.THERAPY_HISTORY_COMPLETED_COUNT(groupId));
      const completedCount = countRes?.data?.completedCount ?? 0;
      if (completedCount < totalVideos) return;

      lastFeedbackVideoRef.current = video.id;

      const feedbackRes = await apiClient.get(ENDPOINTS.THERAPY_FEEDBACK_BY_GROUP(groupId));
      const fb = feedbackRes?.data;
      if (fb?.id) {
        setFeedbackId(fb.id);
        setHasPainBefore(fb.painBefore != null);
      } else {
        setFeedbackId(null);
        setHasPainBefore(false);
      }
    } catch {
      setFeedbackId(null);
      setHasPainBefore(false);
    }

    setPainAfter('5');
    setUserFeedback('');
    setShowFeedbackModal(true);
  }, [catalog, groupId, currentVideoIndex]);

  const handleSkipFeedback = useCallback(() => {
    setShowFeedbackModal(false);
  }, []);

  const handleSaveFeedback = useCallback(async () => {
    setSavingFeedback(true);
    try {
      const payload = {
        painAfter: hasPainBefore ? Math.min(10, Math.max(0, parseInt(painAfter, 10) || 0)) : null,
        userFeedback: userFeedback.trim() || null,
      };

      if (feedbackId) {
        await apiClient.put(ENDPOINTS.THERAPY_FEEDBACK_PAIN_AFTER(feedbackId), payload);
      } else {
        const created = await apiClient.post(ENDPOINTS.THERAPY_FEEDBACK, {
          videoGroupId: groupId,
          sessionType: 'wellness',
        });
        const newId = created?.data?.id;
        if (newId) {
          await apiClient.put(ENDPOINTS.THERAPY_FEEDBACK_PAIN_AFTER(newId), payload);
        }
      }
    } catch {
      // continue even if save fails
    } finally {
      setSavingFeedback(false);
      setShowFeedbackModal(false);
    }
  }, [feedbackId, hasPainBefore, painAfter, userFeedback, groupId]);

  const handleSaveInitialFeedback = useCallback(async () => {
    setSavingInitial(true);
    try {
      const created = await apiClient.post(ENDPOINTS.THERAPY_FEEDBACK, {
        videoGroupId: groupId,
        sessionType: 'wellness',
        painBefore: Math.min(10, Math.max(0, parseInt(painBefore, 10) || 0)),
        userPainDescription: painDescription.trim() || null,
      });
      const newId = created?.data?.id;
      if (newId) setFeedbackId(newId);
      setInitialFeedbackDone(true);
    } catch {
      // continue even if save fails
    } finally {
      setSavingInitial(false);
      setShowInitialFeedback(false);
    }
  }, [groupId, painBefore, painDescription]);

  const handleSkipInitialFeedback = useCallback(() => {
    setShowInitialFeedback(false);
  }, []);

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

  const sliderWidthRef = useRef(0);

  const painSlider = useMemo(() => ({
    panResponder: PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const w = sliderWidthRef.current || 1;
        setPainAfter(String(Math.min(10, Math.max(0, Math.round((x / w) * 10)))));
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const w = sliderWidthRef.current || 1;
        setPainAfter(String(Math.min(10, Math.max(0, Math.round((x / w) * 10)))));
      },
    }),
  }), []);

  const painVal = parseInt(painAfter, 10) || 5;
  const painPct = painVal / 10;

  const initialSliderWidthRef = useRef(0);

  const painBeforeSlider = useMemo(() => ({
    panResponder: PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const w = initialSliderWidthRef.current || 1;
        setPainBefore(String(Math.min(10, Math.max(0, Math.round((x / w) * 10)))));
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const w = initialSliderWidthRef.current || 1;
        setPainBefore(String(Math.min(10, Math.max(0, Math.round((x / w) * 10)))));
      },
    }),
  }), []);

  const painBeforeVal = parseInt(painBefore, 10) || 5;
  const painBeforePct = painBeforeVal / 10;

  // Mark the first video as started once the catalog is in.
  useEffect(() => {
    if (catalog?.videos?.length) {
      syncVideoProgress(groupId, catalog.videos[0].id, 'Pending', 0, 'wellness');
    }
  }, [catalog, groupId]);

  // Check for existing feedback on mount — if none, show initial pain-before popup.
  useEffect(() => {
    if (!catalog || initialFeedbackCheckedRef.current) return;
    initialFeedbackCheckedRef.current = true;

    apiClient.get(ENDPOINTS.THERAPY_FEEDBACK_BY_GROUP(groupId))
      .then(res => {
        const fb = res?.data;
        if (fb?.id) {
          setFeedbackId(fb.id);
          setHasPainBefore(fb.painBefore != null);
          setInitialFeedbackDone(true);
        } else {
          setShowInitialFeedback(true);
        }
      })
      .catch(() => {
        setShowInitialFeedback(true);
      });
  }, [catalog, groupId]);

  const onProgress = useCallback(
    async data => {
      const video = catalog?.videos?.[currentVideoIndex];
      if (!video) return;
      const dur = video.duration || data.seekableDuration || 0;
      const watched = data.currentTime;
      // Fire "Completed" once when crossing 90%.
      if (dur > 0 && watched / dur > 0.9 && watchedRef.current / dur <= 0.9) {
        await syncVideoProgress(groupId, video.id, 'Completed', dur / 60, 'wellness');
        checkAndShowFeedback();
      }
      watchedRef.current = watched;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalog, currentVideoIndex, groupId],
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
        );
      }
      watchedRef.current = 0;
      setCurrentVideoIndex(index);
      syncVideoProgress(groupId, catalog.videos[index].id, 'Pending', 0, 'wellness');
    },
    [catalog, currentVideoIndex, groupId],
  );

  const handleEnd = useCallback(async () => {
    const video = catalog?.videos?.[currentVideoIndex];
    if (video) {
      await syncVideoProgress(groupId, video.id, 'Completed', video.duration / 60, 'wellness');
      checkAndShowFeedback();
    }
  }, [catalog, currentVideoIndex, groupId, checkAndShowFeedback]);

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
        suspendUpNext={showFeedbackModal || showInitialFeedback}
        paused={showInitialFeedback}
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
              <Switch
                value={autoPlayNext}
                onValueChange={handleAutoPlayNextChange}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
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
      <AppDialog
        visible={showFeedbackModal}
        onClose={handleSkipFeedback}
        onConfirm={handleSaveFeedback}
        confirmLabel="Save"
        cancelLabel="Skip"
        confirmLoading={savingFeedback}
        icon="clipboard-text-outline"
        title="Session Feedback"
        subtitle={hasPainBefore ? "How is your pain now? Any feedback?" : "Share your feedback about this session."}
      >
        {hasPainBefore && (
          <View style={styles.feedbackPainRow}>
            <Text style={styles.feedbackPainLabel}>Pain After: {painAfter}/10</Text>
            <View
              style={styles.sliderTrack}
              onLayout={(e) => { sliderWidthRef.current = e.nativeEvent.layout.width; }}
              {...painSlider.panResponder.panHandlers}
            >
              <View style={[styles.sliderFill, { width: `${painPct * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${painPct * 100}%` }]} />
            </View>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>0</Text>
              <Text style={styles.sliderLabelText}>2</Text>
              <Text style={styles.sliderLabelText}>4</Text>
              <Text style={styles.sliderLabelText}>6</Text>
              <Text style={styles.sliderLabelText}>8</Text>
              <Text style={styles.sliderLabelText}>10</Text>
            </View>
          </View>
        )}
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
      <AppDialog
        visible={showInitialFeedback}
        onClose={handleSkipInitialFeedback}
        onConfirm={handleSaveInitialFeedback}
        confirmLabel="Save"
        cancelLabel="Skip"
        confirmLoading={savingInitial}
        icon="clipboard-text-outline"
        title="Initial Pain Assessment"
        subtitle="How severe is your pain right now?"
      >
        <View style={styles.feedbackPainRow}>
          <Text style={styles.feedbackPainLabel}>Pain Level: {painBefore}/10</Text>
          <View
            style={styles.sliderTrack}
            onLayout={(e) => { initialSliderWidthRef.current = e.nativeEvent.layout.width; }}
            {...painBeforeSlider.panResponder.panHandlers}
          >
            <View style={[styles.sliderFill, { width: `${painBeforePct * 100}%` }]} />
            <View style={[styles.sliderThumb, { left: `${painBeforePct * 100}%` }]} />
          </View>
          <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>0</Text>
              <Text style={styles.sliderLabelText}>2</Text>
              <Text style={styles.sliderLabelText}>4</Text>
              <Text style={styles.sliderLabelText}>6</Text>
              <Text style={styles.sliderLabelText}>8</Text>
              <Text style={styles.sliderLabelText}>10</Text>
          </View>
        </View>
        <TextInput
          style={styles.feedbackInput}
          placeholder="Describe your pain (optional)…"
          placeholderTextColor={colors.textMuted}
          value={painDescription}
          onChangeText={setPainDescription}
          multiline
          maxLength={500}
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

  feedbackPainRow: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  feedbackPainLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  sliderTrack: {
    height: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.primary,
    top: -6,
    marginLeft: -10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  sliderLabelText: {
    fontSize: 12,
    color: colors.textMuted,
  },
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
});
