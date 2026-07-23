import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useFocusEffect } from '@react-navigation/native';
import Video from 'react-native-video';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { SessionPlayerSkeleton } from '../components/SkeletonLoader';
import NextVideoModal from '../components/NextVideoModal';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert } from '../utils/alert';

const VideoGroupDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { groupId, groupTitle } = route.params;
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [nextVideoVisible, setNextVideoVisible] = useState(false);

  const [sortMode, setSortMode] = useState(false);
  const [sortedVideos, setSortedVideos] = useState([]);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDuration, setEditDuration] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchCatalog();
    }, [groupId])
  );

  const fetchCatalog = () => {
    setLoading(true);
    apiClient.get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId))
      .then(res => {
        setCatalog(res.data);
        setSortedVideos(res.data?.videos || []);
      })
      .catch(() => showAlert('Error', 'Failed to fetch catalog'))
      .finally(() => setLoading(false));
  };

  const handleVideoEnd = () => {
    const nextIndex = currentVideoIndex + 1;
    if (catalog?.videos && nextIndex < catalog.videos.length) {
      setIsPlaying(false);
      setNextVideoVisible(true);
    }
  };

  const handlePlayNext = () => {
    setCurrentVideoIndex(prev => prev + 1);
    setNextVideoVisible(false);
    setIsPlaying(true);
  };

  const toggleSortMode = () => {
    if (!sortMode) {
      setSortedVideos([...(catalog?.videos || [])]);
    }
    setSortMode(prev => !prev);
  };

  const saveSortOrder = async () => {
    const ids = sortedVideos.map(v => v.id);
    try {
      await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/groups/${groupId}/videos`, {
        video_ids: ids,
      });
      setCatalog(prev => ({ ...prev, videos: sortedVideos }));
      setSortMode(false);
      showAlert('Saved', 'Video order updated');
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to save order');
    }
  };

  const openEditModal = (video) => {
    setEditingVideo(video);
    setEditTitle(video.title || '');
    setEditDescription(video.description || '');
    setEditDuration(String(video.duration || ''));
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editingVideo) return;
    const payload = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      duration: parseInt(editDuration, 10) || 0,
    };
    try {
      await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/${editingVideo.id}`, payload);
      setEditModalVisible(false);
      fetchCatalog();
      showAlert('Saved', 'Video details updated');
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to update video');
    }
  };

  const handleRemoveVideo = (video) => {
    Alert.alert('Remove Video', `Remove "${video.title}" from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const remaining = (catalog?.videos || [])
              .filter(v => v.id !== video.id)
              .map(v => v.id);
            await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/groups/${groupId}/videos`, {
              video_ids: remaining,
            });
            fetchCatalog();
            if (currentVideoIndex >= catalog.videos.length - 1) {
              setCurrentVideoIndex(0);
              setIsPlaying(false);
            }
          } catch (err) {
            showAlert('Error', err?.message || 'Failed to remove video');
          }
        },
      },
    ]);
  };

  const renderSortItem = useCallback(({ item, drag, isActive, getIndex }) => {
    const index = getIndex();
    return (
      <ScaleDecorator>
        <TouchableOpacity activeOpacity={1} onLongPress={drag} delayLongPress={0}>
          <View style={[styles.card, isActive && { backgroundColor: colors.primaryLight }]}>
            <MCIcon name="play-circle-outline" size={28} color={colors.primary} style={styles.icon} />
            <View style={styles.cardContent}>
              <Text style={styles.videoTitle}>{item.title}</Text>
              <Text style={styles.videoMeta}>{Math.floor((item.duration || 0) / 60)} min</Text>
            </View>
            <MCIcon name="drag-variant" size={24} color={colors.textMuted} style={{ paddingHorizontal: 12 }} />
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  }, [colors]);

  const renderVideoItem = ({ item, index }) => {
    const isActive = index === currentVideoIndex;
    const iconName = isActive ? (isPlaying ? 'pause-circle' : 'play-circle') : 'play-circle-outline';
    return (
      <View style={[styles.card, isActive && styles.activeCard]}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => {
            if (isActive) {
              setIsPlaying(prev => !prev);
            } else {
              setCurrentVideoIndex(index);
              setIsPlaying(true);
              setNextVideoVisible(false);
            }
          }}
          onLongPress={() => {
            if (!sortMode) toggleSortMode();
          }}
          activeOpacity={0.7}
        >
          <MCIcon name={iconName} size={32} color={isActive ? colors.white : colors.primary} style={styles.icon} />
          <View style={styles.cardContent}>
            <Text style={[styles.videoTitle, isActive && styles.activeText]}>{item.title}</Text>
            <Text style={[styles.videoMeta, isActive && styles.activeText]}>
              {Math.floor((item.duration || 0) / 60)} min
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHiddenItem = (data, rowMap) => {
    if (sortMode) return <View />;
    return (
      <View style={styles.rowBack}>
        <TouchableOpacity
          style={[styles.backBtn, styles.editBack]}
          onPress={() => { openEditModal(data.item); rowMap[data.item.id]?.closeRow(); }}
        >
          <MCIcon name="pencil" size={22} color="#fff" />
          <Text style={styles.backBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.backBtn, styles.deleteBack]}
          onPress={() => { handleRemoveVideo(data.item); rowMap[data.item.id]?.closeRow(); }}
        >
          <MCIcon name="delete" size={22} color="#fff" />
          <Text style={styles.backBtnText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const currentVideo = (sortMode ? sortedVideos : catalog?.videos)?.[currentVideoIndex];
  const hasNoVideos = catalog && (!catalog.videos || catalog.videos.length === 0);
  const displayVideos = sortMode ? sortedVideos : (catalog?.videos || []);
  const hasSortChanges = sortMode && JSON.stringify(sortedVideos.map(v => v.id)) !== JSON.stringify((catalog?.videos || []).map(v => v.id));

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={groupTitle}
        onBack={() => navigation.goBack()}
        right={
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {!sortMode && (
              <TouchableOpacity onPress={() => navigation.navigate('VideoGroupEditor', { groupId, groupTitle })}>
                <MCIcon name="playlist-edit" size={22} color={colors.headerText} />
              </TouchableOpacity>
            )}
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

          {sortMode ? (
            <View style={styles.sortBanner}>
              <MCIcon name="drag-variant" size={18} color={colors.warning} />
              <Text style={styles.sortBannerText}>Drag the handle to reorder videos</Text>
            </View>
          ) : (
            <View style={styles.playerArea}>
              {currentVideo && currentVideo.videoUrl ? (
                <Video
                  source={{ uri: currentVideo.videoUrl }}
                  style={styles.video}
                  paused={!isPlaying}
                  resizeMode="contain"
                  onEnd={handleVideoEnd}
                />
              ) : (
                <View style={styles.placeholder}><Text>Select a video to play</Text></View>
              )}
              {currentVideo && (
                <TouchableOpacity style={styles.floatingPlayBtn} onPress={() => setIsPlaying(!isPlaying)}>
                  <MCIcon name={isPlaying ? 'pause' : 'play'} size={24} color={colors.white} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {!sortMode && currentVideo && currentVideo.description ? (
            <View style={styles.videoDescriptionBanner}>
              <MCIcon name="playlist-play" size={18} color={colors.accent} style={{marginRight: 8}} />
              <Text style={styles.videoDescriptionText}>{currentVideo.description}</Text>
            </View>
          ) : null}

          {sortMode ? (
            <View style={{ flex: 1 }}>
              <DraggableFlatList
                data={sortedVideos}
                onDragEnd={({ data }) => setSortedVideos(data)}
                keyExtractor={item => item.id.toString()}
                renderItem={renderSortItem}
                contentContainerStyle={styles.list}
              />
              <View style={styles.sortFooter}>
                <Text style={styles.sortFooterText}>
                  {displayVideos.length} video{displayVideos.length !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  style={[styles.sortSaveBtn, !hasSortChanges && { opacity: 0.5 }]}
                  disabled={!hasSortChanges}
                  onPress={saveSortOrder}
                >
                  <MCIcon name="content-save" size={18} color={colors.white} />
                  <Text style={styles.sortSaveText}>Save Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <SwipeListView
              data={displayVideos}
              renderItem={renderVideoItem}
              renderHiddenItem={renderHiddenItem}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.list}
              leftOpenValue={75}
              rightOpenValue={-75}
              closeOnRowPress={true}
              closeOnRowOpen={true}
              closeOnRowBeginSwipe={true}
            />
          )}
        </View>
      )}

      <NextVideoModal
        visible={nextVideoVisible}
        currentTitle={currentVideo?.title || ''}
        nextTitle={catalog?.videos?.[currentVideoIndex + 1]?.title || ''}
        onPlayNext={handlePlayNext}
        onCancel={() => setNextVideoVisible(false)}
        colors={colors}
      />

      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Video</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Video title" placeholderTextColor={colors.textMuted} />
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={editDescription} onChangeText={setEditDescription} placeholder="Description" placeholderTextColor={colors.textMuted} multiline />
            <Text style={styles.label}>Duration (seconds)</Text>
            <TextInput style={styles.input} value={editDuration} onChangeText={setEditDuration} placeholder="e.g. 600" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={{ color: colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={saveEdit}>
                <Text style={{ color: colors.white }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  list: { padding: 16 },
  card: {
    backgroundColor: colors.card, padding: 0, borderRadius: 12, marginBottom: 12,
    elevation: 2, flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  cardMain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16,
  },
  dragHandle: { paddingHorizontal: 12, paddingVertical: 16, justifyContent: 'center', alignItems: 'center' },
  activeCard: { backgroundColor: colors.primary },
  activeText: { color: colors.white },
  icon: { marginRight: 15 },
  cardContent: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  videoMeta: { color: colors.textSecondary, marginTop: 4 },
  playerArea: { width: '100%', height: 220, backgroundColor: colors.black, justifyContent: 'center', alignItems: 'center' },
  video: { width: '100%', height: '100%' },
  placeholder: { color: colors.white },
  floatingPlayBtn: { position: 'absolute', bottom: 16, right: 16, width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 16, fontSize: 16, color: colors.textMuted },
  descriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  descriptionText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, flex: 1 },
  videoDescriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.warning + '1A', borderBottomWidth: 1, borderBottomColor: colors.border },
  videoDescriptionText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, flex: 1 },
  addVideoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  addVideoBtnText: { color: colors.white, fontWeight: '600', marginLeft: 8 },

  sortBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: colors.warning + '1A', borderBottomWidth: 1, borderBottomColor: colors.border },
  sortBannerText: { fontSize: 13, fontWeight: '600', color: colors.warning, flex: 1 },
  sortFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  sortFooterText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  sortSaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  sortSaveText: { fontSize: 14, fontWeight: '700', color: colors.white },

  rowBack: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, borderRadius: 12, overflow: 'hidden',
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    justifyContent: 'center', width: 75, height: '100%',
  },
  editBack: { backgroundColor: colors.primary },
  deleteBack: { backgroundColor: colors.danger },
  backBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.card, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 12, color: colors.textPrimary },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  saveBtn: { backgroundColor: colors.primary },
});

export default VideoGroupDetailScreen;
