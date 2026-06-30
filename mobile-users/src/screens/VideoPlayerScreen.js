import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { syncVideoProgress } from '../utils/videoTracker';
import VideoPlayer from '../components/VideoPlayer';

const VideoPlayerScreen = ({ route, navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { groupId } = route.params;

  const [catalog, setCatalog] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const watchedRef = useRef(0); // seconds watched of the current video

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
      }
      watchedRef.current = watched;
    },
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
    if (video) syncVideoProgress(groupId, video.id, 'Completed', video.duration / 60, 'wellness');
  }, [catalog, currentVideoIndex, groupId]);

  const hasNext = !!catalog && currentVideoIndex < catalog.videos.length - 1;
  const goNext = useCallback(() => {
    if (hasNext) goToVideo(currentVideoIndex + 1, true);
  }, [hasNext, currentVideoIndex, goToVideo]);

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <View style={styles.loadBadge}>
          <MCIcon name="play-circle-outline" size={40} color={colors.primary} />
        </View>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
        <Text style={styles.loadText}>Loading sessions…</Text>
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
    </View>
  );
};

export default VideoPlayerScreen;

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: colors.background },
  loadBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadText: { fontSize: 13, color: colors.textMuted, marginTop: 10 },

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
    borderRadius: 12,
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

  errorText: { fontSize: 16, color: colors.textSecondary, marginTop: 16, marginBottom: 24, textAlign: 'center' },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  backBtnText: { color: colors.white, fontWeight: '700' },
});
