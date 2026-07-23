import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { SessionPlayerSkeleton } from '../components/SkeletonLoader';
import VideoPlayer from '../components/VideoPlayer';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert } from '../utils/alert';

// Autoplay-next preference — remembered across sessions, on by default.
const AUTOPLAY_NEXT_KEY = 'video_autoplay_next';

const VideoGroupDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { groupId, groupTitle } = route.params;
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [autoPlayNext, setAutoPlayNext] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchCatalog();
      AsyncStorage.getItem(AUTOPLAY_NEXT_KEY)
        .then(stored => { if (stored === '0') setAutoPlayNext(false); })
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId])
  );

  const handleAutoPlayNextChange = useCallback(next => {
    setAutoPlayNext(next);
    AsyncStorage.setItem(AUTOPLAY_NEXT_KEY, next ? '1' : '0').catch(() => {});
  }, []);

  const fetchCatalog = () => {
    setLoading(true);
    apiClient.get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId))
      .then(res => setCatalog(res.data))
      .catch(() => showAlert('Error', 'Failed to fetch catalog'))
      .finally(() => setLoading(false));
  };

  const renderVideo = ({ item, index }) => {
    const isActive = index === currentVideoIndex;
    return (
      <TouchableOpacity
        style={[styles.card, isActive && styles.activeCard]}
        onPress={() => setCurrentVideoIndex(index)}
      >
        <MCIcon
          name={isActive ? 'play-circle' : 'play-circle-outline'}
          size={32}
          color={isActive ? colors.white : colors.primary}
          style={styles.icon}
        />
        <View style={styles.cardContent}>
          <Text style={[styles.videoTitle, isActive && styles.activeText]}>{item.title}</Text>
          <Text style={[styles.videoMeta, isActive && styles.activeText]}>{Math.floor(item.duration / 60)} min</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const currentVideo = catalog?.videos ? catalog.videos[currentVideoIndex] : null;
  const nextVideo = catalog?.videos ? catalog.videos[currentVideoIndex + 1] : null;
  const hasNext = !!nextVideo;
  const hasNoVideos = catalog && (!catalog.videos || catalog.videos.length === 0);

  const goNext = useCallback(() => {
    setCurrentVideoIndex(i => (catalog?.videos?.[i + 1] ? i + 1 : i));
  }, [catalog]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={groupTitle}
        onBack={() => navigation.goBack()}
        right={
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.navigate('VideoGroupEditor', { groupId, groupTitle })}>
              <MCIcon name="playlist-edit" size={22} color={colors.headerText} />
            </TouchableOpacity>
          </View>
        }
      />
      
      {loading ? <SessionPlayerSkeleton /> : hasNoVideos ? (
        <View style={styles.emptyContainer}>
          <MCIcon name="video-off" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>No videos in this group</Text>
          <TouchableOpacity style={styles.addVideoBtn} onPress={() => navigation.navigate('VideoGroupEditor', { groupId, groupTitle })}>
            <MCIcon name="playlist-edit" size={20} color={colors.white} />
            <Text style={styles.addVideoBtnText}>Manage Videos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.container}>
            {catalog?.description ? (
              <View style={styles.descriptionBanner}>
                <MCIcon name="information-outline" size={18} color={colors.primary} style={{marginRight: 8}} />
                <Text style={styles.descriptionText}>{catalog.description}</Text>
              </View>
            ) : null}

            <VideoPlayer
              source={currentVideo?.videoUrl ? { uri: currentVideo.videoUrl } : null}
              sourceId={currentVideo?.id}
              poster={<MCIcon name="play-circle-outline" size={72} color={colors.primary} />}
              onNext={goNext}
              hasNext={hasNext}
              nextTitle={nextVideo?.title}
              nextSubtitle={nextVideo ? `${Math.floor(nextVideo.duration / 60)} min` : null}
              autoPlayNext={autoPlayNext}
            />

            {catalog?.videos?.length > 1 && (
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

            {currentVideo && currentVideo.description ? (
              <View style={styles.videoDescriptionBanner}>
                <MCIcon name="playlist-play" size={18} color={colors.accent} style={{marginRight: 8}} />
                <Text style={styles.videoDescriptionText}>{currentVideo.description}</Text>
              </View>
            ) : null}

            <FlatList 
                data={catalog?.videos || []} 
                renderItem={renderVideo} 
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.list}
            />
        </View>
      )}

    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  list: { padding: 16 },
  card: { backgroundColor: colors.card, padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  activeCard: { backgroundColor: colors.primary },
  activeText: { color: colors.white },
  icon: { marginRight: 15 },
  cardContent: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  videoMeta: { color: colors.textSecondary, marginTop: 4 },
  autoPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, color: colors.textMuted },
  descriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  descriptionText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, flex: 1 },
  videoDescriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.warning + '1A', borderBottomWidth: 1, borderBottomColor: colors.border },
  videoDescriptionText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, flex: 1 },
  addVideoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  addVideoBtnText: { color: colors.white, fontWeight: '600', marginLeft: 8 },
});

export default VideoGroupDetailScreen;