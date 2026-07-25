import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { SessionPlayerSkeleton } from '../components/SkeletonLoader';
import VideoPlayer from '../components/VideoPlayer';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppToggle from '../components/AppToggle';
import SwipeRowActions, { SWIPE_LEFT_OPEN, SWIPE_RIGHT_OPEN } from '../components/SwipeRowActions';
import { showAlert, showConfirm } from '../utils/alert';

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
  // Opening the screen must NOT start playback — an admin browsing a group is
  // reviewing the list, not watching. Playback only auto-starts once they pick
  // a video (or the playlist advances), which is an explicit request to play.
  const [autoPlay, setAutoPlay] = useState(false);
  // Collapsing the player hands the whole screen to the video list.
  const [playerCollapsed, setPlayerCollapsed] = useState(false);

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
      .then(res => {
        setCatalog(res.data);
        setSortedVideos(res.data?.videos || []);
      })
      .catch(() => showAlert('Error', 'Failed to fetch catalog'))
      .finally(() => setLoading(false));
  };

  const toggleSortMode = () => {
    if (!sortMode) setSortedVideos([...(catalog?.videos || [])]);
    setSortMode(prev => !prev);
  };

  const saveSortOrder = async () => {
    try {
      await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/groups/${groupId}/videos`, {
        video_ids: sortedVideos.map(v => v.id),
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
    try {
      await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/${editingVideo.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        duration: parseInt(editDuration, 10) || 0,
      });
      setEditModalVisible(false);
      fetchCatalog();
      showAlert('Saved', 'Video details updated');
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to update video');
    }
  };

  // Removes the video from THIS group (the catalog entry itself is untouched —
  // deleting a video outright is done from Video Management).
  const handleRemoveVideo = (video) => {
    showConfirm(
      'Remove Video',
      `Remove "${video.title}" from this group? The video stays in the library.`,
      async () => {
        try {
          const remaining = (catalog?.videos || []).filter(v => v.id !== video.id).map(v => v.id);
          await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/groups/${groupId}/videos`, {
            video_ids: remaining,
          });
          setCurrentVideoIndex(i => (i >= remaining.length ? 0 : i));
          fetchCatalog();
        } catch (err) {
          showAlert('Error', err?.message || 'Failed to remove video');
        }
      },
      { confirmLabel: 'Remove', destructive: true },
    );
  };

  const renderSortItem = useCallback(({ item, drag, isActive }) => (
    <ScaleDecorator>
      <TouchableOpacity activeOpacity={1} onLongPress={drag} delayLongPress={0}>
        <View style={[styles.card, isActive && styles.cardDragging]}>
          <View style={styles.cardMain}>
            <MCIcon name="play-circle-outline" size={28} color={colors.primary} style={styles.icon} />
            <View style={styles.cardContent}>
              <Text style={styles.videoTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.videoMeta}>{Math.floor((item.duration || 0) / 60)} min</Text>
            </View>
          </View>
          <View style={styles.dragHandle}>
            <MCIcon name="drag-variant" size={24} color={colors.textMuted} />
          </View>
        </View>
      </TouchableOpacity>
    </ScaleDecorator>
  ), [styles, colors]);

  // Row front: the whole card is one tap target — edit/remove live behind it
  // on the swipe layer, not as buttons on the card.
  const renderVideoItem = ({ item, index }) => {
    const isPlaying = index === currentVideoIndex;
    return (
      <View style={[styles.card, isPlaying && styles.activeCard]}>
        <TouchableOpacity
          style={styles.cardMain}
          activeOpacity={0.7}
          onPress={() => playVideoAt(index)}
          onLongPress={toggleSortMode}
        >
          <MCIcon
            name={isPlaying ? 'play-circle' : 'play-circle-outline'}
            size={32}
            color={isPlaying ? colors.white : colors.primary}
            style={styles.icon}
          />
          <View style={styles.cardContent}>
            <Text style={[styles.videoTitle, isPlaying && styles.activeText]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={[styles.videoMeta, isPlaying && styles.activeText]}>
              {Math.floor((item.duration || 0) / 60)} min
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Swipe right reveals Edit on the left, swipe left reveals Remove on the
  // right. Same gesture as the rest of the app (see SwipeRowActions); the right
  // action is "Remove" (from group) rather than a catalog delete.
  const renderHiddenItem = (data, rowMap) => {
    if (sortMode) return <View />;
    return (
      <SwipeRowActions
        containerStyle={styles.rowBack}
        onClose={() => rowMap[data.item.id]?.closeRow()}
        onEdit={() => openEditModal(data.item)}
        onDelete={() => handleRemoveVideo(data.item)}
        deleteLabel="Remove"
        deleteIcon="playlist-remove"
      />
    );
  };

  const displayVideos = sortMode ? sortedVideos : (catalog?.videos || []);
  const currentVideo = catalog?.videos?.[currentVideoIndex] || null;
  const nextVideo = catalog?.videos?.[currentVideoIndex + 1] || null;
  const hasNext = !!nextVideo;
  const hasNoVideos = catalog && (!catalog.videos || catalog.videos.length === 0);
  const hasSortChanges =
    sortMode &&
    JSON.stringify(sortedVideos.map(v => v.id)) !== JSON.stringify((catalog?.videos || []).map(v => v.id));

  const goNext = useCallback(() => {
    setAutoPlay(true);
    setCurrentVideoIndex(i => (catalog?.videos?.[i + 1] ? i + 1 : i));
  }, [catalog]);

  // Tapping a row is an explicit "play this" — unlike arriving on the screen.
  const playVideoAt = useCallback(index => {
    setAutoPlay(true);
    setPlayerCollapsed(false);
    setCurrentVideoIndex(index);
  }, []);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={groupTitle}
        onBack={() => (sortMode ? setSortMode(false) : navigation.goBack())}
        right={
          <View style={styles.headerActions}>
            {sortMode ? (
              <TouchableOpacity onPress={() => setSortMode(false)}>
                <MCIcon name="close" size={22} color={colors.headerText} />
              </TouchableOpacity>
            ) : (
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
              <MCIcon name="information-outline" size={18} color={colors.primary} style={styles.bannerIcon} />
              <Text style={styles.descriptionText} numberOfLines={2}>{catalog.description}</Text>
            </View>
          ) : null}

          {sortMode ? (
            <View style={styles.sortBanner}>
              <MCIcon name="drag-variant" size={18} color={colors.warning} />
              <Text style={styles.sortBannerText}>Drag the handle to reorder videos</Text>
            </View>
          ) : (
            <>
              {/* The player is capped well under half the screen and can be
                  collapsed outright, so the video list below always has room
                  to scroll rather than being squeezed into a sliver. */}
              {!playerCollapsed && (
                <VideoPlayer
                  source={currentVideo?.videoUrl ? { uri: currentVideo.videoUrl } : null}
                  sourceId={currentVideo?.id}
                  poster={<MCIcon name="play-circle-outline" size={72} color={colors.primary} />}
                  onNext={goNext}
                  hasNext={hasNext}
                  nextTitle={nextVideo?.title}
                  nextSubtitle={nextVideo ? `${Math.floor(nextVideo.duration / 60)} min` : null}
                  autoPlayNext={autoPlayNext}
                  autoPlay={autoPlay}
                  maxHeightRatio={0.38}
                />
              )}

              <TouchableOpacity
                style={styles.playerBar}
                onPress={() => setPlayerCollapsed(c => !c)}
                activeOpacity={0.7}
              >
                <MCIcon
                  name={playerCollapsed ? 'chevron-down' : 'chevron-up'}
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={styles.playerBarText} numberOfLines={1}>
                  {playerCollapsed
                    ? `Show player${currentVideo?.title ? ` · ${currentVideo.title}` : ''}`
                    : 'Hide player'}
                </Text>
              </TouchableOpacity>

              {!playerCollapsed && catalog?.videos?.length > 1 && (
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

              {!playerCollapsed && currentVideo?.description ? (
                <View style={styles.videoDescriptionBanner}>
                  <MCIcon name="playlist-play" size={18} color={colors.accent} style={styles.bannerIcon} />
                  <Text style={styles.videoDescriptionText} numberOfLines={2}>
                    {currentVideo.description}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {sortMode ? (
            <View style={styles.flex1}>
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
                  style={[styles.sortSaveBtn, !hasSortChanges && styles.sortSaveBtnDisabled]}
                  disabled={!hasSortChanges}
                  onPress={saveSortOrder}
                >
                  <MCIcon name="content-save" size={18} color={hasSortChanges ? colors.white : colors.textMuted} />
                  <Text style={[styles.sortSaveText, !hasSortChanges && styles.sortSaveTextDisabled]}>
                    Save Order
                  </Text>
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
              leftOpenValue={SWIPE_LEFT_OPEN}
              rightOpenValue={SWIPE_RIGHT_OPEN}
              closeOnRowPress
              closeOnRowOpen
              closeOnRowBeginSwipe
            />
          )}
        </View>
      )}

      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
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
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={saveEdit}>
                <Text style={styles.saveBtnText}>Save</Text>
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
  flex1: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  list: { padding: 16 },

  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    elevation: 2,
  },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardDragging: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  dragHandle: { paddingHorizontal: 12, paddingVertical: 16, justifyContent: 'center' },
  activeCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  activeText: { color: colors.white },
  icon: { marginRight: 15 },
  cardContent: { flex: 1 },
  videoTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  videoMeta: { color: colors.textSecondary, marginTop: 4 },

  // Only spacing/rounding here — the swipe layer itself lives in SwipeRowActions.
  rowBack: { marginBottom: 12, borderRadius: 12 },

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
  addVideoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  addVideoBtnText: { color: colors.white, fontWeight: '600', marginLeft: 8 },

  bannerIcon: { marginRight: 8 },
  playerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  playerBarText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, flexShrink: 1 },
  descriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  descriptionText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, flex: 1 },
  videoDescriptionBanner: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.warning + '1A', borderBottomWidth: 1, borderBottomColor: colors.border },
  videoDescriptionText: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, flex: 1 },

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
  // Disabled state is drawn, not faded: opacity alone reads as "washed out" in
  // light mode and near-invisible in dark. See VideoManagementScreen.
  sortSaveBtnDisabled: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  sortSaveText: { fontSize: 14, fontWeight: '700', color: colors.white },
  sortSaveTextDisabled: { color: colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.modalSurface, padding: 20, borderRadius: 16 , borderWidth: 1, borderColor: colors.modalBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12},
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: colors.textPrimary },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.textPrimary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 12, color: colors.textPrimary, backgroundColor: colors.surfaceMuted },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  modalBtnText: { color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnText: { color: colors.white, fontWeight: '700' },
});

export default VideoGroupDetailScreen;
