import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert, Modal, Pressable } from 'react-native';
import Video from 'react-native-video';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
import { SessionPlayerSkeleton } from '../components/SkeletonLoader';

const VideoGroupDetailScreen = ({ route, navigation }) => {
  const { groupId, groupTitle } = route.params;
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const [addVideoModalVisible, setAddVideoModalVisible] = useState(false);
  const [allVideos, setAllVideos] = useState([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());
  const [videosLoading, setVideosLoading] = useState(false);

  useEffect(() => {
    fetchCatalog();
  }, [groupId]);

  const fetchCatalog = () => {
    setLoading(true);
    apiClient.get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId))
      .then(res => setCatalog(res.data))
      .catch(() => Alert.alert('Error', 'Failed to fetch catalog'))
      .finally(() => setLoading(false));
  };

  const openAddVideoModal = () => {
    setVideosLoading(true);
    setAddVideoModalVisible(true);
    Promise.all([
      apiClient.get(ENDPOINTS.ALL_VIDEOS),
      apiClient.get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId)),
    ])
      .then(([allRes, groupRes]) => {
        const all = allRes.data?.videos || [];
        const groupVideoIds = new Set((groupRes.data?.videos || []).map(v => v.id));
        setAllVideos(all);
        setSelectedVideoIds(groupVideoIds);
      })
      .catch(() => Alert.alert('Error', 'Failed to load videos'))
      .finally(() => setVideosLoading(false));
  };

  const toggleVideo = (videoId) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const handleSaveVideos = () => {
    apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/groups/${groupId}/videos`, {
      video_ids: Array.from(selectedVideoIds),
    })
      .then(() => {
        setAddVideoModalVisible(false);
        fetchCatalog();
      })
      .catch(() => Alert.alert('Error', 'Failed to update videos'));
  };

  const renderVideo = ({ item, index }) => {
    const isActive = index === currentVideoIndex;
    const iconName = isActive ? (isPlaying ? 'pause-circle' : 'play-circle') : 'play-circle-outline';
    return (
      <TouchableOpacity 
        style={[styles.card, isActive && styles.activeCard]} 
        onPress={() => {
            if (isActive) {
              setIsPlaying(prev => !prev);
            } else {
              setCurrentVideoIndex(index);
              setIsPlaying(true);
            }
        }}
      >
        <MCIcon name={iconName} size={32} color={isActive ? COLORS.white : COLORS.primary} style={styles.icon} />
        <View style={styles.cardContent}>
          <Text style={[styles.videoTitle, isActive && styles.activeText]}>{item.title}</Text>
          <Text style={[styles.videoMeta, isActive && styles.activeText]}>{Math.floor(item.duration / 60)} min</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const currentVideo = catalog?.videos ? catalog.videos[currentVideoIndex] : null;
  const hasNoVideos = catalog && (!catalog.videos || catalog.videos.length === 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} /></TouchableOpacity>
        <Text style={styles.headerTitle}>{groupTitle}</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('UploadVideo', { videoGroupId: groupId })}>
            <MCIcon name="cloud-upload" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openAddVideoModal}>
            <MCIcon name="pencil" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {loading ? <SessionPlayerSkeleton /> : hasNoVideos ? (
        <View style={styles.emptyContainer}>
          <MCIcon name="video-off" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No videos in this group</Text>
          <TouchableOpacity style={styles.addVideoBtn} onPress={openAddVideoModal}>
            <MCIcon name="pencil" size={20} color={COLORS.white} />
            <Text style={styles.addVideoBtnText}>Manage Videos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.container}>
            {catalog?.description ? (
              <View style={styles.descriptionBanner}>
                <MCIcon name="information-outline" size={18} color={COLORS.primary} style={{marginRight: 8}} />
                <Text style={styles.descriptionText}>{catalog.description}</Text>
              </View>
            ) : null}

            <View style={styles.playerArea}>
                {currentVideo && currentVideo.videoUrl ? (
                    <Video
                        source={{ uri: currentVideo.videoUrl }}
                        style={styles.video}
                        paused={!isPlaying}
                        resizeMode="contain"
                    />
                ) : (
                    <View style={styles.placeholder}><Text>Select a video to play</Text></View>
                )}
                {currentVideo && (
                    <TouchableOpacity style={styles.floatingPlayBtn} onPress={() => setIsPlaying(!isPlaying)}>
                        <MCIcon name={isPlaying ? 'pause' : 'play'} size={24} color={COLORS.white} />
                    </TouchableOpacity>
                )}
            </View>

            {currentVideo && currentVideo.description ? (
              <View style={styles.videoDescriptionBanner}>
                <MCIcon name="playlist-play" size={18} color={COLORS.accent} style={{marginRight: 8}} />
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

      {/* Add/Remove Videos Modal */}
      <Modal visible={addVideoModalVisible} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setAddVideoModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Manage Videos</Text>
            {videosLoading ? (
              <ActivityIndicator size="large" style={{padding: 40}} />
            ) : (
              <FlatList
                data={allVideos}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => {
                  const isSelected = selectedVideoIds.has(item.id);
                  return (
                    <TouchableOpacity style={styles.videoPickerCard} onPress={() => toggleVideo(item.id)}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <MCIcon name="check" size={18} color={COLORS.white} />}
                      </View>
                      <MCIcon name={item.icon || 'play-circle'} size={24} color={COLORS.primary} style={{marginRight: 12}} />
                      <View style={styles.cardContent}>
                        <Text style={styles.videoPickerTitle}>{item.title}</Text>
                        {item.description ? (
                          <Text style={styles.videoPickerDesc} numberOfLines={1}>{item.description}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                style={{maxHeight: 400}}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setAddVideoModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveVideos}><Text style={{color: COLORS.white}}>Save</Text></TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, padding: 20, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  container: { flex: 1 },
  list: { padding: 16 },
  card: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  activeCard: { backgroundColor: COLORS.primary },
  activeText: { color: COLORS.white },
  icon: { marginRight: 15 },
  cardContent: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: '700' },
  videoMeta: { color: COLORS.textSecondary, marginTop: 4 },
  playerArea: { width: '100%', height: 220, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  placeholder: { color: COLORS.white },
  floatingPlayBtn: { position: 'absolute', bottom: 16, right: 16, width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, color: COLORS.textMuted },
  descriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  descriptionText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, flex: 1 },
  videoDescriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF9E6', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  videoDescriptionText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, flex: 1 },
  addVideoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  addVideoBtnText: { color: COLORS.white, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: '#EEE' },
  saveBtn: { backgroundColor: COLORS.primary },
  videoPickerCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 6, backgroundColor: '#F9F9F9' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxSelected: { backgroundColor: COLORS.primary },
  videoPickerTitle: { fontSize: 14, fontWeight: '600' },
  videoPickerDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});

export default VideoGroupDetailScreen;