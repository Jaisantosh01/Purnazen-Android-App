import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
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
  headerBackBtn: { padding: 8, marginRight: 8 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  playerArea: { width: '100%', height: 250, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  video: { width: '100%', height: '100%' },
  placeholderIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
  floatingPlayBtn: { position: 'absolute', bottom: 16, right: 16, width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  currentInfoCard: { backgroundColor: COLORS.white, padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  videoTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  videoDescription: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  errorText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 16, marginBottom: 24, textAlign: 'center' },
  backBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
  backBtnText: { color: COLORS.white, fontWeight: '700' },
});
