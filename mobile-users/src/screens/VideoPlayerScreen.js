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
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { syncVideoProgress } from '../utils/videoTracker';
import VideoPlayer from '../components/VideoPlayer';
import AppDialog from '../components/AppDialog';

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

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [hasPainBefore, setHasPainBefore] = useState(false);
  const [painAfter, setPainAfter] = useState('5');
  const [userFeedback, setUserFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackId, setFeedbackId] = useState(null);

  const watchedRef = useRef(0); // seconds watched of the current video
  const feedbackCheckDoneRef = useRef(false); // prevent duplicate checks

  const checkAndShowFeedback = useCallback(async () => {
    if (feedbackCheckDoneRef.current) return;
    const totalVideos = catalog?.videos?.length;
    if (!totalVideos) return;

    try {
      const countRes = await apiClient.get(ENDPOINTS.THERAPY_HISTORY_COMPLETED_COUNT(groupId));
      const completedCount = countRes?.data?.completedCount ?? 0;
      if (completedCount < totalVideos) return;

      feedbackCheckDoneRef.current = true;

      try {
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
    } catch {
      // ignore errors
    }
  }, [catalog, groupId]);

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

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId))
      .then(res => setCatalog(res.data))
      .catch(err => setError(err.message || 'Failed to load video catalog'))
      .finally(() => setLoading(false));
  }, [groupId]);

  // Mark the first video as started once the catalog is in.
  useEffect(() => {
    if (catalog?.videos?.length) {
      syncVideoProgress(groupId, catalog.videos[0].id, 'Pending', 0, 'wellness');
    }
  }, [catalog, groupId]);

  const onProgress = useCallback(
    data => {
      const video = catalog?.videos?.[currentVideoIndex];
      if (!video) return;
      const dur = video.duration || data.seekableDuration || 0;
      const watched = data.currentTime;
      // Fire "Completed" once when crossing 90%.
      if (dur > 0 && watched / dur > 0.9 && watchedRef.current / dur <= 0.9) {
        syncVideoProgress(groupId, video.id, 'Completed', dur / 60, 'wellness');
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

  const handleEnd = useCallback(() => {
    const video = catalog?.videos?.[currentVideoIndex];
    if (video) {
      syncVideoProgress(groupId, video.id, 'Completed', video.duration / 60, 'wellness');
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
        poster={
          <MCIcon name={currentVideo.icon || 'play-circle-outline'} size={80} color={colors.primary} />
        }
        onProgress={onProgress}
        onEnd={handleEnd}
        onNext={goNext}
        hasNext={hasNext}
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
            <View style={styles.feedbackPainBtns}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.feedbackPainBtn,
                    parseInt(painAfter, 10) === n && styles.feedbackPainBtnActive,
                  ]}
                  onPress={() => setPainAfter(String(n))}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.feedbackPainBtnText,
                      parseInt(painAfter, 10) === n && styles.feedbackPainBtnTextActive,
                    ]}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
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
  },
  feedbackPainLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  feedbackPainBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  feedbackPainBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  feedbackPainBtnActive: {
    backgroundColor: colors.primary,
  },
  feedbackPainBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  feedbackPainBtnTextActive: {
    color: colors.white,
    fontWeight: '800',
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
