import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ICONS_PER_PAGE, WELLNESS_ICONS } from '../constants/icons';
import { DirGridSkeleton } from '../components/SkeletonLoader';
import VideoPlayer from '../components/VideoPlayer';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert } from '../utils/alert';
import { handlePickFiles as sharedHandlePickFiles, uploadOne as sharedUploadOne, handleUploadAll as sharedHandleUploadAll } from '../utils/UploadHelper';

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/ogg'];

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const titleFromFilename = (name) =>
  (name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

const extractBlobPath = (sasUrl) => {
  try {
    const url = new URL(sasUrl);
    // pathname = /CONTAINER/videos/folder/video.mp4
    const parts = url.pathname.split('/');
    parts.shift(); // remove leading ''
    parts.shift(); // remove container name
    return decodeURIComponent(parts.join('/'));
  } catch {
    return sasUrl;
  }
};

const STATUS_META = {
  pending: { icon: 'clock-outline', color: '#9CA3AF' },
  uploading: { icon: 'progress-upload', color: '#3B82F6' },
  done: { icon: 'check-circle', color: '#10B981' },
  failed: { icon: 'alert-circle', color: '#EF4444' },
};

const VideoGroupEditorScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { groupId, groupTitle } = route.params;

  // Storage browser
  const [directories, setDirectories] = useState([]);
  const [dirFiles, setDirFiles] = useState([]);
  const [dirsLoading, setDirsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [createDirModal, setCreateDirModal] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  // All video records (for mapping storage paths → IDs)
  const [allVideos, setAllVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(true);

  // Currently assigned video IDs (from the group)
  const [assignedVideoIds, setAssignedVideoIds] = useState(new Set());

  // Selected video IDs (for saving)
  const [selectedVideoIds, setSelectedVideoIds] = useState(new Set());

  // Upload queue
  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Target picker for upload items
  const [targetPickerFor, setTargetPickerFor] = useState(null);
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Icon picker
  const [iconPickerFor, setIconPickerFor] = useState(null);
  const [iconPage, setIconPage] = useState(0);
  const totalIconPages = Math.ceil(WELLNESS_ICONS.length / ICONS_PER_PAGE);

  // Selected videos dropdown
  const [selectedExpanded, setSelectedExpanded] = useState(false);

  // Track which folders have been fully imported
  const [selectedDirs, setSelectedDirs] = useState(new Set());

  // Folder import loading
  const [folderLoading, setFolderLoading] = useState(null);

  // Video preview
  const [previewVideo, setPreviewVideo] = useState(null);

  const cancelledRef = useRef(false);
  const savingRef = useRef(false);
  const savedRef = useRef(false);
  const selectedRef = useRef(selectedVideoIds);
  selectedRef.current = selectedVideoIds;
  const hasChangesRef = useRef(false);
  const handleSaveRef = useRef(null);

  const confirmBack = useCallback((e) => {
    if (!hasChangesRef.current || savedRef.current || savingRef.current) return true;

    const discard = () => {
      savedRef.current = true;
      if (e) {
        navigation.dispatch(e.data.action);
      } else {
        navigation.goBack();
      }
    };

    Alert.alert(
      'Unsaved Changes',
      'Save changes to the group before leaving?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: discard },
        { text: 'Save', onPress: () => handleSaveRef.current?.() },
      ]
    );
    return false;
  }, [navigation]);

  // Intercept back navigation — swipe gesture + Android hardware button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!hasChangesRef.current || savedRef.current || savingRef.current) return;
      e.preventDefault();
      confirmBack(e);
    });
    return unsubscribe;
  }, [navigation, confirmBack]);

  // Also intercept the header back button directly
  const handleBackPress = useCallback(() => {
    if (!hasChangesRef.current || savedRef.current || savingRef.current) {
      navigation.goBack();
      return;
    }
    confirmBack(null);
  }, [navigation, confirmBack]);

  // Load group catalog + all videos on mount
  useEffect(() => {
    Promise.all([
      apiClient.get(ENDPOINTS.VIDEO_GROUP_CATALOG(groupId)),
      apiClient.get(ENDPOINTS.ALL_VIDEOS),
      apiClient.get(ENDPOINTS.VIDEO_GROUPS),
      apiClient.get(ENDPOINTS.ALL_SESSIONS),
    ])
      .then(([catalogRes, videosRes, groupsRes, sessionsRes]) => {
        const groupVideoIds = new Set((catalogRes.data?.videos || []).map(v => v.id));
        setAssignedVideoIds(groupVideoIds);
        setSelectedVideoIds(new Set(groupVideoIds));
        setAllVideos(videosRes.data?.videos || []);
        setGroups((groupsRes?.data?.groups || []).filter(g => g.is_active !== false));
        setSessions(sessionsRes?.data?.sessions || []);
      })
      .catch(() => showAlert('Error', 'Failed to load initial data'))
      .finally(() => setVideosLoading(false));
    return () => { cancelledRef.current = true; };
  }, [groupId]);

  // Load storage directories when path changes
  useEffect(() => {
    fetchDirectories();
  }, [currentPath]);

  const fetchDirectories = () => {
    setDirsLoading(true);
    const params = currentPath ? { parent: currentPath } : {};
    apiClient.get(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { params })
      .then(res => {
        setDirectories(res?.data?.directories || []);
        setDirFiles(res?.data?.files || []);
      })
      .catch(() => {
        setDirectories([]);
        setDirFiles([]);
      })
      .finally(() => setDirsLoading(false));
  };

  // Build a lookup: storage path → video record
  const videoByStoragePath = useMemo(() => {
    const map = {};
    allVideos.forEach(v => {
      const path = v.videoUrl ? extractBlobPath(v.videoUrl) : '';
      if (path) map[path] = v;
    });
    return map;
  }, [allVideos]);

  // Filter videos that belong to the current storage path
  const videosInCurrentPath = useMemo(() => {
    const pathPrefix = currentPath || '';
    return allVideos.filter(v => {
      const rawPath = v.videoUrl ? extractBlobPath(v.videoUrl) : '';
      return rawPath.startsWith(pathPrefix) && rawPath.length > pathPrefix.length;
    });
  }, [allVideos, currentPath]);

  // Total video-format files visible in the current folder (with or without DB record)
  const visibleVideoCount = useMemo(() => {
    const vidExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'ogg', 'wmv', 'flv', 'm4v', '3gp'];
    const fromStorage = dirFiles.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext && vidExts.includes(ext);
    }).length;
    // DB-only videos not backed by a storage file in this folder
    const dbOnly = videosInCurrentPath.filter(v => {
      const rawPath = v.videoUrl ? extractBlobPath(v.videoUrl) : '';
      return rawPath && !dirFiles.some(f => f.name === rawPath);
    }).length;
    return fromStorage + dbOnly;
  }, [dirFiles, videosInCurrentPath]);

  const toggleVideo = (videoId) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const isVideoSelected = (videoId) => selectedVideoIds.has(videoId);

  const selectAllInFolder = () => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      videosInCurrentPath.forEach(v => next.add(v.id));
      return next;
    });
  };

  const deselectAllInFolder = () => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      videosInCurrentPath.forEach(v => next.delete(v.id));
      return next;
    });
  };

  const navigateInto = (dir) => setCurrentPath(dir);

  const navigateBreadcrumb = (index) => {
    const crumbs = currentPath.replace(/\/$/, '').split('/').filter(Boolean);
    const targetParts = crumbs.slice(0, index + 1);
    setCurrentPath(targetParts.length > 0 ? targetParts.join('/') + '/' : '');
  };

  const handleCreateDir = () => {
    const name = newDirName.trim().replace(/^\/+|\/+$/g, '');
    if (!name) { showAlert('Error', 'Enter a folder name'); return; }
    const path = currentPath + name + '/';
    apiClient.post(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { path })
      .then(() => {
        setCreateDirModal(false);
        setNewDirName('');
        fetchDirectories();
      })
      .catch(() => showAlert('Error', 'Failed to create folder'));
  };

  // Upload queue
  const handlePickFiles = async () => {
    await sharedHandlePickFiles(
      currentPath,
      '', // selectedDir is empty in VideoGroupEditorScreen
      dirFiles,
      groupId,
      setItems,
      setExpandedId,
      showAlert
    );
  };

  const uploadOne = async (item) => {
    await sharedUploadOne(item, currentPath);
  };

  const updateItem = (id, patch) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const applyTarget = (target) => {
    if (targetPickerFor === '__all__') {
      setItems(prev => prev.map(it => (it.status === 'done' ? it : { ...it, ...target })));
    } else if (targetPickerFor) {
      updateItem(targetPickerFor, target);
    }
    setTargetPickerFor(null);
  };

  const refreshStorageAndVideos = () => {
    fetchDirectories();
    apiClient.get(ENDPOINTS.ALL_VIDEOS)
      .then(res => setAllVideos(res.data?.videos || []))
      .catch(() => {});
  };

  const handleUploadAll = async () => {
    await sharedHandleUploadAll({
      items,
      updateItem,
      setItems,
      setUploading,
      setUploadProgress,
      cancelledRef,
      fetchDirectories: refreshStorageAndVideos,
      showAlert,
      selectedDir: currentPath,
      uploadOne: sharedUploadOne,
    });
  };

  const readyToUpload = items.some(it => it.status === 'pending');
  const canUpload = !uploading && items.length > 0 && readyToUpload;

  // Save
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/groups/${groupId}/videos`, {
        video_ids: Array.from(selectedVideoIds),
      });
      savedRef.current = true;
      showAlert('Saved', 'Videos updated for this group', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to save videos');
    } finally {
      savingRef.current = false;
    }
  }, [groupId, selectedVideoIds]);
  handleSaveRef.current = handleSave;

  const crumbs = currentPath ? currentPath.replace(/\/$/, '').split('/').filter(Boolean) : [];
  const hasChanges = selectedVideoIds.size !== assignedVideoIds.size ||
    !Array.from(selectedVideoIds).every(id => assignedVideoIds.has(id));
  hasChangesRef.current = hasChanges;

  const handleAddFolder = async (dir) => {
    setFolderLoading(dir);
    try {
      const res = await apiClient.post(ENDPOINTS.VIDEO_ADD_FOLDER, {
        prefix: dir,
      });
      const newVideos = res?.data?.videos || [];
      const fresh = newVideos.filter(v => !selectedRef.current.has(v.id));
      if (newVideos.length > 0) {
        setAllVideos(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const deduped = [...prev, ...newVideos.filter(v => !existingIds.has(v.id))];
          return deduped;
        });
        if (fresh.length > 0) {
          setSelectedVideoIds(prev => new Set([...prev, ...fresh.map(v => v.id)]));
        }
      }
      setSelectedDirs(prev => new Set(prev).add(dir));
      showAlert('Folder Added', res?.message || `${newVideos.length} video(s) imported`);
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to add folder');
    } finally {
      setFolderLoading(null);
    }
  };

  const handleAddToLibrary = async (file) => {
    try {
      const payload = {
        title: titleFromFilename(file.name),
        description: '',
        duration: 0,
        icon: 'play-circle',
        videoUrl: file.name,
        videoGroupId: null,
        sortOrder: 0,
      };
      const res = await apiClient.post(ENDPOINTS.ALL_VIDEOS, payload);
      const newVideo = res?.data;
      if (newVideo) {
        setAllVideos(prev => [...prev, newVideo]);
        setSelectedVideoIds(prev => new Set([...prev, newVideo.id]));
      } else {
        showAlert('Error', 'No video data in response');
      }
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to add video to library');
    }
  };

  // ── Renderers ──

  const renderGridDir = (dir) => {
    const displayName = dir.replace(/\/$/, '').split('/').pop() || dir;
    const loading = folderLoading === dir;
    const isImported = selectedDirs.has(dir);
    return (
      <TouchableOpacity key={dir} style={[styles.dirGridItem, isImported && styles.selectedGridItem]} onPress={() => navigateInto(dir)}>
        <MCIcon name="folder" size={28} color={colors.warning} />
        <Text style={styles.dirGridText} numberOfLines={1}>{displayName}</Text>
        <TouchableOpacity
          style={styles.folderAddBtn}
          onPress={() => handleAddFolder(dir)}
          disabled={!!folderLoading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : isImported ? (
            <MCIcon name="checkbox-marked" size={16} color="#10B981" />
          ) : (
            <MCIcon name="folder-plus" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderGridFile = (file) => {
    const displayName = file.name.split('/').pop() || file.name;
    const video = videoByStoragePath[file.name];
    const isSelected = video && isVideoSelected(video.id);
    return (
      <TouchableOpacity
        key={file.name}
        style={[styles.dirGridItem, styles.fileGridItem, isSelected && styles.selectedGridItem]}
        onPress={() => video && toggleVideo(video.id)}
        disabled={!video}
        activeOpacity={video ? 0.7 : 1}
      >
        {video ? (
          <>
            <View style={styles.gridCheckbox}>
              <MCIcon
                name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={isSelected ? colors.primary : colors.textMuted}
              />
            </View>
            <TouchableOpacity style={styles.gridPlayBtn} onPress={() => setPreviewVideo(video)}>
              <MCIcon name="play-circle" size={22} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            {file.videoUrl ? (
              <TouchableOpacity style={styles.gridPlayBtn} onPress={() => setPreviewVideo(file)}>
                <MCIcon name="play-circle" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <MCIcon name="movie-outline" size={26} color={colors.textMuted} />
            )}
          </>
        )}
        <Text style={styles.dirGridText} numberOfLines={2}>{video ? video.title : displayName}</Text>
        {!!file.size && <Text style={styles.fileSizeText}>{formatBytes(file.size)}</Text>}
        {!video && file.videoUrl && (
          <TouchableOpacity style={styles.addLibBtn} onPress={() => handleAddToLibrary(file)}>
            <MCIcon name="plus-circle" size={14} color={colors.white} />
            <Text style={styles.addLibText}>Add</Text>
          </TouchableOpacity>
        )}
        {!video && !file.videoUrl && <Text style={styles.fileMissingText}>No record</Text>}
      </TouchableOpacity>
    );
  };

  const renderListDir = ({ item }) => {
    const displayName = item.replace(/\/$/, '').split('/').pop() || item;
    const loading = folderLoading === item;
    const isImported = selectedDirs.has(item);
    return (
      <TouchableOpacity style={[styles.dirListItem, isImported && styles.selectedListItem]} onPress={() => navigateInto(item)}>
        <MCIcon name="folder" size={22} color={colors.warning} />
        <Text style={styles.dirListText}>{displayName}</Text>
        <TouchableOpacity
          style={styles.folderAddBtnList}
          onPress={() => handleAddFolder(item)}
          disabled={!!folderLoading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isImported ? (
            <MCIcon name="checkbox-marked" size={18} color="#10B981" />
          ) : (
            <MCIcon name="folder-plus" size={18} color={colors.primary} />
          )}
        </TouchableOpacity>
        <MCIcon name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderListFile = ({ item }) => {
    const displayName = item.name.split('/').pop() || item.name;
    const video = videoByStoragePath[item.name];
    const isSelected = video && isVideoSelected(video.id);
    return (
      <TouchableOpacity
        style={[styles.dirListItem, isSelected && styles.selectedListItem]}
        onPress={() => video && toggleVideo(video.id)}
        disabled={!video}
        activeOpacity={video ? 0.7 : 1}
      >
        {video ? (
          <>
            <MCIcon
              name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={isSelected ? colors.primary : colors.textMuted}
            />
            <TouchableOpacity onPress={() => setPreviewVideo(video)} style={{ padding: 2 }}>
              <MCIcon name="play-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            {item.videoUrl ? (
              <TouchableOpacity onPress={() => setPreviewVideo(item)} style={{ padding: 2 }}>
                <MCIcon name="play-circle-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <MCIcon name="movie-outline" size={22} color={colors.textMuted} />
            )}
          </>
        )}
        <Text style={[styles.dirListText, !video && { color: colors.textMuted }]} numberOfLines={1}>
          {video ? video.title : displayName}
        </Text>
        {!!item.size && <Text style={styles.fileSizeText}>{formatBytes(item.size)}</Text>}
        {!video && item.videoUrl && (
          <TouchableOpacity style={styles.addLibBtnList} onPress={() => handleAddToLibrary(item)}>
            <MCIcon name="plus-circle" size={16} color={colors.primary} />
            <Text style={styles.addLibTextList}>Add</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderQueueItem = (item) => {
    const meta = STATUS_META[item.status] || STATUS_META.pending;
    const isExpanded = expandedId === item.id;
    return (
      <View key={item.id} style={styles.queueCard}>
        <TouchableOpacity
          style={styles.queueHeader}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.8}
        >
          {item.status === 'uploading'
            ? <ActivityIndicator size="small" color={meta.color} />
            : <MCIcon name={meta.icon} size={20} color={meta.color} />}
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text style={styles.queueTitle} numberOfLines={1}>{item.title || item.file.name}</Text>
            <Text style={styles.queueMeta} numberOfLines={1}>
              {item.file.name}{item.file.size ? ` • ${formatBytes(item.file.size)}` : ''}
            </Text>
            {item.status === 'failed' && !!item.error && (
              <Text style={styles.queueError} numberOfLines={2}>{item.error}</Text>
            )}
          </View>
          {item.status !== 'uploading' && item.status !== 'done' && (
            <TouchableOpacity onPress={() => removeItem(item.id)} style={{ padding: 4 }}>
              <MCIcon name="close-circle" size={20} color={colors.danger} />
            </TouchableOpacity>
          )}
          <MCIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.queueBody}>
            <Text style={styles.smallLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Video title"
              placeholderTextColor={colors.textMuted}
              value={item.title}
              onChangeText={t => updateItem(item.id, { title: t })}
              editable={!uploading && item.status !== 'done'}
            />

            <Text style={styles.smallLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description"
              placeholderTextColor={colors.textMuted}
              value={item.description}
              onChangeText={t => updateItem(item.id, { description: t })}
              multiline
              editable={!uploading && item.status !== 'done'}
            />

            <Text style={styles.smallLabel}>Duration (seconds)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 600"
              placeholderTextColor={colors.textMuted}
              value={item.duration}
              onChangeText={t => updateItem(item.id, { duration: t })}
              keyboardType="numeric"
              editable={!uploading && item.status !== 'done'}
            />

            <Text style={styles.smallLabel}>Filename (save as in Azure)</Text>
            <TextInput
              style={styles.input}
              placeholder="filename.mp4"
              placeholderTextColor={colors.textMuted}
              value={item.saveAs || ''}
              onChangeText={t => {
                const existingNames = new Set(dirFiles.map(f => (f.name || '').split('/').pop()?.toLowerCase().trim()));
                const isDup = existingNames.has(t.toLowerCase().trim());
                  updateItem(item.id, {
                    saveAs: t,
                    status: isDup ? 'failed' : 'pending',
                    error: isDup ? 'A file with this name already exists in this folder.' : null,
                  });
              }}
              editable={!uploading && item.status !== 'done'}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.overwriteRow}
              onPress={() => {
                if (uploading || item.status === 'done') return;
                const next = !item.overwrite;
                updateItem(item.id, {
                  overwrite: next,
                  status: item.status === 'failed' ? 'pending' : item.status,
                  error: next ? null : item.error,
                });
              }}
              disabled={uploading || item.status === 'done'}
            >
              <MCIcon
                name={item.overwrite ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={item.overwrite ? colors.warning : colors.textMuted}
              />
              <Text style={[styles.overwriteLabel, item.overwrite && { color: colors.warning }]}>
                Overwrite if file exists in this folder
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const allSelectedInFolder = videosInCurrentPath.length > 0 &&
    videosInCurrentPath.every(v => selectedVideoIds.has(v.id));
  const someSelectedInFolder = videosInCurrentPath.some(v => selectedVideoIds.has(v.id));

  if (videosLoading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Edit Group Videos" onBack={handleBackPress} />
        <ActivityIndicator size="large" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={groupTitle}
        subtitle="Edit videos"
        onBack={handleBackPress}
      />

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: items.length > 0 ? 70 : 120 }}>
        {/* File Picker */}
        <Text style={styles.label}>Upload New Videos</Text>
        <TouchableOpacity style={styles.filePicker} onPress={handlePickFiles} disabled={uploading}>
          <MCIcon name="cloud-upload" size={32} color={colors.primary} />
          <Text style={styles.filePickerText}>
            {items.length > 0
              ? `${items.length} video${items.length > 1 ? 's' : ''} selected — tap to add more`
              : 'Tap to select one or more video files to upload'}
          </Text>
        </TouchableOpacity>

        {/* Upload queue */}
        {items.length > 0 && (
          <>
            <View style={styles.queueToolbar}>
              <Text style={styles.queueCount}>New uploads ({items.filter(it => it.status !== 'done').length})</Text>
            </View>
            {items.map(renderQueueItem)}
          </>
        )}

        {items.length === 0 && (
        <>
        {/* Storage Browser */}
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>
            Cloud Storage {currentPath ? `(${visibleVideoCount} video${visibleVideoCount !== 1 ? 's' : ''})` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {videosInCurrentPath.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.selectFolderBtn}
                  onPress={allSelectedInFolder ? deselectAllInFolder : selectAllInFolder}
                >
                  <MCIcon
                    name={allSelectedInFolder ? 'checkbox-marked' : someSelectedInFolder ? 'minus-box' : 'checkbox-blank-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.selectFolderText}>
                    {allSelectedInFolder ? 'Deselect all' : 'Select all'}
                  </Text>
                </TouchableOpacity>
                <View style={{ width: 1, backgroundColor: colors.border }} />
              </>
            )}
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleActive]}
              onPress={() => setViewMode('grid')}
            >
              <MCIcon name="grid" size={18} color={viewMode === 'grid' ? colors.white : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleActive]}
              onPress={() => setViewMode('list')}
            >
              <MCIcon name="format-list-bulleted" size={18} color={viewMode === 'list' ? colors.white : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Breadcrumb */}
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity style={styles.breadcrumbItem} onPress={() => setCurrentPath('')}>
            <MCIcon name="home" size={16} color={colors.primary} />
          </TouchableOpacity>
          {crumbs.map((part, i) => (
            <React.Fragment key={i}>
              <MCIcon name="chevron-right" size={14} color={colors.textMuted} />
              <TouchableOpacity onPress={() => navigateBreadcrumb(i)}>
                <Text style={[styles.breadcrumbText, i === crumbs.length - 1 && styles.breadcrumbActive]}>{part}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.createDirBtn} onPress={fetchDirectories}>
            <MCIcon name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createDirBtn} onPress={() => setCreateDirModal(true)}>
            <MCIcon name="folder-plus" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Directory + file listing */}
        {dirsLoading ? (
          <DirGridSkeleton />
        ) : directories.length === 0 && dirFiles.length === 0 && videosInCurrentPath.length === 0 ? (
          <View style={styles.emptyDirs}>
            <MCIcon name="folder-open-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyDirText}>This folder is empty</Text>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.dirsGrid}>
            {directories.map(renderGridDir)}
            {dirFiles.map(renderGridFile)}
            {/* Show video records not backed by storage files (e.g. old uploads) */}
            {currentPath === '' && allVideos.filter(v => {
              const rawPath = v.videoUrl ? extractBlobPath(v.videoUrl) : '';
              return !dirFiles.some(f => f.name === rawPath) && !rawPath.includes('/');
            }).map(v => {
              const isSelected = isVideoSelected(v.id);
              return (
                <TouchableOpacity
                  key={`vid-${v.id}`}
                  style={[styles.dirGridItem, styles.fileGridItem, isSelected && styles.selectedGridItem]}
                  onPress={() => toggleVideo(v.id)}
                >
                  <View style={styles.gridCheckbox}>
                    <MCIcon
                      name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={22}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <MCIcon name="play-circle" size={26} color={colors.primary} />
                  <Text style={styles.dirGridText} numberOfLines={2}>{v.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.dirList}>
            <FlatList
              data={directories}
              keyExtractor={item => item}
              renderItem={renderListDir}
              scrollEnabled={false}
            />
            <FlatList
              data={dirFiles}
              keyExtractor={item => item.name}
              renderItem={renderListFile}
              scrollEnabled={false}
            />
            {/* Video records not in storage listing */}
            {currentPath === '' && allVideos.filter(v => {
              const rawPath = v.videoUrl ? extractBlobPath(v.videoUrl) : '';
              return !dirFiles.some(f => f.name === rawPath) && !rawPath.includes('/');
            }).map(v => {
              const isSelected = isVideoSelected(v.id);
              return (
                <TouchableOpacity
                  key={`vid-${v.id}`}
                  style={[styles.dirListItem, isSelected && styles.selectedListItem]}
                  onPress={() => toggleVideo(v.id)}
                >
                  <MCIcon
                    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                  <MCIcon name="play-circle" size={20} color={colors.primary} style={{ marginLeft: 4 }} />
                  <Text style={styles.dirListText} numberOfLines={1}>{v.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        </>
        )}
      </ScrollView>

      {/* Expanded selection dropdown — opens ABOVE the bar */}
      {selectedExpanded && selectedVideoIds.size > 0 && (
        <View style={styles.selectedDropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {allVideos.filter(v => selectedVideoIds.has(v.id)).map(v => (
              <View key={v.id} style={styles.selectedDropdownRow}>
                <MCIcon name="play-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.selectedDropdownText} numberOfLines={1}>{v.title}</Text>
                <TouchableOpacity onPress={() => toggleVideo(v.id)} style={{ padding: 4 }}>
                  <MCIcon name="close-circle" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {items.length === 0 && (
      <>
      {/* Selection bar — sticky above Save */}
      <View style={styles.selectionBar}>
        <TouchableOpacity
          style={styles.selectionBarInner}
          onPress={() => setSelectedExpanded(s => !s)}
          activeOpacity={0.7}
        >
          <MCIcon name="checkbox-marked-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.selectionBarText}>
            {selectedVideoIds.size} video{selectedVideoIds.size !== 1 ? 's' : ''} selected for this group
          </Text>
          <MCIcon
            name={selectedExpanded ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, !hasChanges && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!hasChanges || savingRef.current}
        >
          {savingRef.current ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <MCIcon name="content-save" size={22} color={colors.white} />
          )}
          <Text style={styles.saveBtnText}>
            {savingRef.current ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </View>
      </>
      )}

      {/* Upload bottom bar — shown when items are queued */}
      {items.length > 0 && (
      <View style={styles.uploadFooter}>
        <View style={styles.uploadFooterLeft}>
          <MCIcon name="folder" size={18} color={colors.primary} />
          <Text style={styles.uploadFooterText} numberOfLines={1}>
            {currentPath || 'root'}
          </Text>
          <MCIcon name="check-circle" size={18} color={colors.primary} />
        </View>
        {uploading ? (
          <TouchableOpacity
            style={styles.uploadCancelBtn}
            onPress={() => {
              cancelledRef.current = true;
              setItems([]);
              setExpandedId(null);
            }}
          >
            <MCIcon name="stop-circle" size={20} color={colors.white} />
            <Text style={styles.uploadCancelBtnText}>Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.uploadFooterBtn, !canUpload && { opacity: 0.5 }]}
            onPress={handleUploadAll}
            disabled={!canUpload}
          >
            <MCIcon name="cloud-upload" size={20} color={colors.white} />
            <Text style={styles.uploadFooterBtnText}>
              Upload {items.filter(it => it.status === 'pending').length} Video{items.filter(it => it.status === 'pending').length > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      )}

      {/* Video Preview Modal */}
      <Modal visible={!!previewVideo} transparent animationType="fade" onRequestClose={() => setPreviewVideo(null)}>
        <TouchableOpacity style={styles.modalOverlayCentered} activeOpacity={1} onPress={() => setPreviewVideo(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {previewVideo?.title || (previewVideo?.name ? titleFromFilename(previewVideo.name) : 'Video')}
              </Text>
              <TouchableOpacity onPress={() => setPreviewVideo(null)}>
                <MCIcon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {previewVideo?.videoUrl && (
              <View style={styles.previewVideo}>
                {/* No fullscreen from inside a modal card — it would only fill
                    the card, not the screen. */}
                <VideoPlayer
                  source={{ uri: previewVideo.videoUrl }}
                  sourceId={previewVideo.videoUrl}
                  allowFullscreen={false}
                />
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Create Directory Modal */}
      <Modal visible={createDirModal} transparent animationType="fade" onRequestClose={() => setCreateDirModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              New Folder in {currentPath ? `"${currentPath.replace(/\/$/, '').split('/').pop()}"` : 'root'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Folder name"
              placeholderTextColor={colors.textMuted}
              value={newDirName}
              onChangeText={setNewDirName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setCreateDirModal(false)}><Text style={{ color: colors.textPrimary }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleCreateDir}><Text style={{ color: colors.white }}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Target picker */}
      <Modal visible={!!targetPickerFor} transparent animationType="fade" onRequestClose={() => setTargetPickerFor(null)}>
        <TouchableOpacity style={styles.modalOverlayCentered} activeOpacity={1} onPress={() => setTargetPickerFor(null)}>
          <View style={styles.targetPickerCard}>
            <Text style={styles.modalTitle}>
              {targetPickerFor === '__all__' ? 'Set group for all new uploads' : 'Select group'}
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.targetSection}>Video Groups</Text>
              {groups.length === 0 && <Text style={styles.targetEmpty}>No groups available</Text>}
              {groups.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.targetOption}
                  onPress={() => applyTarget({ groupId: g.id, sessionId: null })}
                >
                  <MCIcon name={g.icon || 'folder'} size={20} color={colors.primary} />
                  <Text style={styles.targetOptionText}>{g.title}</Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.targetSection, { marginTop: 12 }]}>Sessions</Text>
              {sessions.length === 0 && <Text style={styles.targetEmpty}>No sessions available</Text>}
              {sessions.map(s => {
                const linked = !!s.videoGroupId;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.targetOption, !linked && { opacity: 0.45 }]}
                    disabled={!linked}
                    onPress={() => applyTarget({ groupId: s.videoGroupId, sessionId: s.id })}
                  >
                    <MCIcon name={s.icon || 'meditation'} size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.targetOptionText}>{s.title}</Text>
                      {!linked && <Text style={styles.targetEmpty}>No video group linked</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Icon Selector Modal */}
      <Modal visible={!!iconPickerFor} transparent animationType="fade" onRequestClose={() => setIconPickerFor(null)}>
        <TouchableOpacity style={styles.modalOverlayCentered} activeOpacity={1} onPress={() => { setIconPickerFor(null); setIconPage(0); }}>
          <View style={styles.iconPickerCard}>
            <View style={styles.wellnessIconGrid}>
              {WELLNESS_ICONS.slice(iconPage * ICONS_PER_PAGE, (iconPage + 1) * ICONS_PER_PAGE).map(ic => {
                const current = items.find(it => it.id === iconPickerFor)?.icon;
                return (
                  <TouchableOpacity
                    key={ic}
                    style={[styles.wellnessIconBox, current === ic && styles.wellnessIconBoxSelected]}
                    onPress={() => { updateItem(iconPickerFor, { icon: ic }); setIconPickerFor(null); setIconPage(0); }}
                  >
                    <MCIcon name={ic} size={26} color={current === ic ? colors.white : colors.textPrimary} />
                  </TouchableOpacity>
                );
              })}
            </View>
            {totalIconPages > 1 && (
              <View style={styles.iconPagination}>
                <TouchableOpacity
                  style={[styles.iconPageBtn, iconPage === 0 && { opacity: 0.3 }]}
                  disabled={iconPage === 0}
                  onPress={() => setIconPage(p => p - 1)}
                >
                  <MCIcon name="chevron-left" size={20} color={colors.textPrimary} />
                  <Text style={styles.iconPageText}>Prev</Text>
                </TouchableOpacity>
                <Text style={styles.iconPageIndicator}>{iconPage + 1} / {totalIconPages}</Text>
                <TouchableOpacity
                  style={[styles.iconPageBtn, iconPage >= totalIconPages - 1 && { opacity: 0.3 }]}
                  disabled={iconPage >= totalIconPages - 1}
                  onPress={() => setIconPage(p => p + 1)}
                >
                  <Text style={styles.iconPageText}>Next</Text>
                  <MCIcon name="chevron-right" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  smallLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 4, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.card },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  filePicker: {
    borderWidth: 2, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 12,
    padding: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    backgroundColor: colors.primaryLight,
  },
  filePickerText: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },

  // Upload queue
  queueToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  queueCount: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  queueCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 8, backgroundColor: colors.card, overflow: 'hidden' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  queueTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  queueMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  queueError: { fontSize: 11, color: '#EF4444', marginTop: 2 },
  queueBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border },
  overwriteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 6 },
  overwriteLabel: { fontSize: 13, fontWeight: '500', color: colors.textMuted, flex: 1 },
  pickerInput: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: colors.card },
  pickerInputText: { flex: 1, fontSize: 13, color: colors.textPrimary },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selectFolderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  selectFolderText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  viewToggleBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  viewToggleActive: { backgroundColor: colors.primary },

  // Breadcrumb
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' },
  breadcrumbItem: { padding: 4 },
  breadcrumbText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  breadcrumbActive: { color: colors.primary },

  // Directory grid mode
  dirsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  dirGridItem: {
    width: '30%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  fileGridItem: { backgroundColor: colors.surfaceMuted },
  selectedGridItem: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  gridCheckbox: { position: 'absolute', top: 6, right: 6 },
  dirGridText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, marginTop: 6, textAlign: 'center' },
  fileSizeText: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  fileMissingText: { fontSize: 9, color: colors.danger, marginTop: 2 },

  // Directory list mode
  dirList: { marginBottom: 8 },
  dirListItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8,
  },
  selectedListItem: { backgroundColor: colors.primaryLight },
  dirListText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },

  // Empty state
  emptyDirs: { alignItems: 'center', paddingVertical: 24 },
  emptyDirText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },

  createDirBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  folderAddBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  folderAddBtnList: { paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', justifyContent: 'center' },
  gridPlayBtn: { position: 'absolute', bottom: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  addLibBtn: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  addLibText: { fontSize: 9, fontWeight: '700', color: colors.white },
  addLibBtnList: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  addLibTextList: { fontSize: 12, fontWeight: '600', color: colors.primary },
  previewCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, maxWidth: 500, width: '100%' },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  previewTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 12 },
  // Height comes from the player itself (it sizes to the clip's aspect ratio).
  previewVideo: { width: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: colors.black },

  // Selection bar (fixed above footer)
  selectionBar: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20, paddingVertical: 10 },
  selectionBarInner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colors.primaryLight },
  selectionBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  selectedDropdown: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 20, paddingVertical: 4, maxHeight: 220 },
  selectedDropdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  selectedDropdownText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary },

  // Footer
  footer: { padding: 20, paddingBottom: 32, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, padding: 16, borderRadius: 12 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },

  // Upload bottom bar (shown when items queued)
  uploadFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  uploadFooterLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  uploadFooterText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 },
  uploadFooterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  uploadFooterBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  uploadCancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  uploadCancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.card, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  targetPickerCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, maxWidth: 420, width: '100%' },
  targetSection: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  targetEmpty: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  targetOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2 },
  targetOptionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  iconPickerCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, maxWidth: 400, width: '100%' },
  iconPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  iconPageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  iconPageText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  iconPageIndicator: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  wellnessIconGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 8 },
  wellnessIconBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surfaceMuted, margin: 5, alignItems: 'center', justifyContent: 'center' },
  wellnessIconBoxSelected: { backgroundColor: colors.primary },
});

export default VideoGroupEditorScreen;
