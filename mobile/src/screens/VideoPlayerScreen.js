import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const VideoPlayerScreen = ({ route, navigation }) => {
  const { groupId, groupTitle } = route.params;

  const [catalog, setCatalog] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId))
      .then(res => {
        setCatalog(res.data);
      })
      .catch(err => {
        setError(err.message || 'Failed to load video catalog');
      })
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !catalog || !catalog.videos.length) {
    return (
      <View style={styles.center}>
        <MCIcon name="alert-circle-outline" size={60} color={COLORS.danger} />
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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{catalog.title}</Text>
          <Text style={styles.headerSubtitle}>{catalog.videos.length} recommended sessions</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Player Area */}
        <View style={styles.playerArea}>
          {currentVideo.videoUrl ? (
            <Video
              source={{ uri: currentVideo.videoUrl }}
              style={styles.video}
              paused={!isPlaying}
              resizeMode="contain"
              repeat={false}
              onEnd={() => setIsPlaying(false)}
            />
          ) : (
            <View style={styles.placeholderIcon}>
              <MCIcon name={currentVideo.icon || 'play-circle-outline'} size={80} color={COLORS.primary} />
            </View>
          )}
          <TouchableOpacity 
            style={styles.floatingPlayBtn} 
            onPress={() => setIsPlaying(!isPlaying)}
            activeOpacity={0.85}
          >
            <MCIcon name={isPlaying ? 'pause' : 'play'} size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Current Video Info */}
        <View style={styles.currentInfoCard}>
          <Text style={styles.videoTitle}>{currentVideo.title}</Text>
          <Text style={styles.videoDescription}>{currentVideo.description}</Text>
          <View style={styles.metaRow}>
             <MCIcon name="clock-outline" size={14} color={COLORS.textMuted} />
             <Text style={styles.metaText}>{Math.floor(currentVideo.duration / 60)} min</Text>
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
                onPress={() => {
                  setCurrentVideoIndex(index);
                  setIsPlaying(true);
                }}
              >
                <View style={[styles.rowNumberCircle, isActive && styles.rowNumberActive]}>
                   {isActive ? (
                     <MCIcon name="play" size={14} color={COLORS.white} />
                   ) : (
                     <Text style={styles.rowNumberText}>{index + 1}</Text>
                   )}
                </View>
                <View style={styles.rowInfo}>
                   <Text style={[styles.rowTitle, isActive && styles.rowTitleActive]}>{video.title}</Text>
                   <Text style={styles.rowDuration}>{Math.floor(video.duration / 60)} min</Text>
                </View>
                <MCIcon name="chevron-right" size={20} color={COLORS.border} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default VideoPlayerScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerBackBtn: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  
  playerArea: {
    width: '100%',
    height: 250,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  video: { width: '100%', height: '100%' },
  placeholderIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingPlayBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },

  currentInfoCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  videoTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  videoDescription: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: COLORS.textMuted },

  playlistSection: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 1, marginBottom: 16 },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  videoRowActive: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  rowNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowNumberActive: { backgroundColor: COLORS.primary },
  rowNumberText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  rowTitleActive: { color: COLORS.primary },
  rowDuration: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 24, textAlign: 'center' },
  backBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
  },
  backBtnText: { color: COLORS.white, fontWeight: '700' },
});
