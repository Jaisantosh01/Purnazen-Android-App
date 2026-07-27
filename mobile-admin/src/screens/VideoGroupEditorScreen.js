import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
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
import StorageFileActionsModal from '../components/StorageFileActionsModal';
import useDurationProbe from '../hooks/useDurationProbe';
import { showAlert } from '../utils/alert';
import { handlePickFiles as sharedHandlePickFiles, uploadOne as sharedUploadOne, handleUploadAll as sharedHandleUploadAll } from '../utils/UploadHelper';

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/ogg'];

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!total) return '';
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
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

  // Blob path currently being given a library record on demand (see
  // ensureLibraryRecord) — drives the per-tile spinner.
  const [linkingPath, setLinkingPath] = useState(null);

  // Video preview
  const [previewVideo, setPreviewVideo] = useState(null);

  // Per-file storage actions (move / delete)
  const [fileActionFor, setFileActionFor] = useState(null);

  // Library-metadata editor for an already-stored (Azure) video: the storage
  // listing only knows the blob, so title/description/duration have to be
  // editable here rather than only at upload time.
  const [metaEditor, setMetaEditor] = useState(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaDuration, setMetaDuration] = useState('');
  const [metaSaving, setMetaSaving] = useState(false);

  // Saving state (drives the header Save action's spinner)
  const [saving, setSaving] = useState(false);

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

    showAlert(
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
    // Clear any cancel flag left by a previous mount of this screen, otherwise
    // the next upload run stops after its first request.
    cancelledRef.current = false;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showAlert,
      items
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

  // Refetch storage + the video library whenever this screen regains focus, so
  // renames/moves/deletes done in the upload browser (or anywhere else) show up
  // here too. Only the library + listing refresh — the group selection is left
  // alone so unsaved picks survive. A ref keeps the handler pointed at the
  // latest closure (current folder), and we skip the initial focus since mount
  // already loads everything.
  const refreshRef = useRef(refreshStorageAndVideos);
  refreshRef.current = refreshStorageAndVideos;
  const focusInitRef = useRef(false);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (!focusInitRef.current) { focusInitRef.current = true; return; }
      refreshRef.current();
    });
    return unsub;
  }, [navigation]);

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
      // The upload endpoint already attached each new video to this group, so
      // mirror that locally. Without it the next Save would post a video_ids
      // list that omits the upload and immediately unassign it again.
      onUploaded: videos => {
        const newIds = videos.map(v => v.id).filter(Boolean);
        if (!newIds.length) return;
        setAllVideos(prev => {
          const known = new Set(prev.map(v => v.id));
          return [...prev, ...videos.filter(v => v.id && !known.has(v.id))];
        });
        setAssignedVideoIds(prev => new Set([...prev, ...newIds]));
        setSelectedVideoIds(prev => new Set([...prev, ...newIds]));
      },
    });
  };

  // Auto-detect each new file's duration; keep it required so a failed probe
  // (or an unusual codec) still can't upload a 0-second video.
  const { probeElement, pendingProbe } = useDurationProbe(items, updateItem);
  const pendingItems = items.filter(it => it.status === 'pending');
  const allHaveDuration = pendingItems.every(it => parseInt(it.duration, 10) > 0);
  const readyToUpload = pendingItems.length > 0;
  const canUpload = !uploading && readyToUpload && allHaveDuration;
  const uploadHint = allHaveDuration
    ? null
    : pendingProbe
      ? 'Detecting duration…'
      : 'Enter a duration (seconds) for every video';

  // Save
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
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
      setSaving(false);
    }
  }, [groupId, selectedVideoIds, navigation]);
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

  // Toggle a folder's import state. Tapping an already-imported folder used to
  // silently re-import it (there was no way to undo) — the "deselect isn't
  // working, it keeps selecting the folder" bug. Now a second tap deselects:
  // every video living under that folder's prefix is dropped from the group
  // selection and the folder's imported mark is cleared.
  const handleToggleFolder = (dir) => {
    if (!selectedDirs.has(dir)) {
      handleAddFolder(dir);
      return;
    }
    const underPrefix = new Set(
      allVideos
        .filter(v => (v.videoUrl ? extractBlobPath(v.videoUrl) : '').startsWith(dir))
        .map(v => v.id),
    );
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      underPrefix.forEach(id => next.delete(id));
      return next;
    });
    setSelectedDirs(prev => {
      const next = new Set(prev);
      next.delete(dir);
      return next;
    });
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
        return newVideo;
      }
      showAlert('Error', 'No video data in response');
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to add video to library');
    }
    return null;
  };

  /**
   * Every tile behaves the same way regardless of whether the blob already has
   * a library record: the record is created on demand the first time the admin
   * ticks or edits the file. That's what removes the old two-tier grid where
   * some cards had a checkbox + "Edit details" and others only a "+".
   */
  const ensureLibraryRecord = async (file) => {
    const existing = videoByStoragePath[file.name];
    if (existing) return existing;
    setLinkingPath(file.name);
    try {
      return await handleAddToLibrary(file);
    } finally {
      setLinkingPath(null);
    }
  };

  const handleFileToggle = async (file) => {
    const video = videoByStoragePath[file.name];
    if (video) {
      toggleVideo(video.id);
      return;
    }
    // ensureLibraryRecord selects the new record for this group as it creates it.
    await ensureLibraryRecord(file);
  };

  const handleFileEdit = async (file) => {
    const video = videoByStoragePath[file.name] || (await ensureLibraryRecord(file));
    if (video) openMetaEditor(video);
  };

  // Edit the library record behind a stored blob (title / description /
  // duration). Duration in particular matters: imports land at 0 and the apps
  // show it on the session cards.
  const openMetaEditor = (video) => {
    setMetaEditor(video);
    setMetaTitle(video.title || '');
    setMetaDescription(video.description || '');
    setMetaDuration(video.duration ? String(video.duration) : '');
  };

  const saveMetaEditor = async () => {
    if (!metaEditor) return;
    const title = metaTitle.trim();
    if (!title) {
      showAlert('Title required', 'Give the video a title before saving.');
      return;
    }
    const duration = parseInt(metaDuration, 10);
    if (metaDuration.trim() && (isNaN(duration) || duration < 0)) {
      showAlert('Invalid duration', 'Duration must be a whole number of seconds.');
      return;
    }
    setMetaSaving(true);
    try {
      const payload = {
        title,
        description: metaDescription.trim(),
        duration: isNaN(duration) ? 0 : duration,
      };
      await apiClient.put(`${ENDPOINTS.ALL_VIDEOS}/${metaEditor.id}`, payload);
      setAllVideos(prev =>
        prev.map(v => (v.id === metaEditor.id ? { ...v, ...payload } : v)),
      );
      setMetaEditor(null);
      showAlert('Saved', 'Video details updated');
    } catch (err) {
      showAlert('Error', err?.message || 'Failed to update video details');
    } finally {
      setMetaSaving(false);
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
          onPress={() => handleToggleFolder(dir)}
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

  /**
   * A file tile: a fixed-height media box on top (where every floating control
   * lives) and a text block underneath in normal flow. The controls used to be
   * absolutely positioned over the whole tile, which is what put the play button
   * on top of the filename and size.
   *
   * Every tile renders the same controls — checkbox, play, overflow, "Edit
   * details" — whether or not the blob already has a library record. Ticking or
   * editing a file that has no record creates one first (ensureLibraryRecord),
   * so the grid never shows two different kinds of card.
   */
  const renderGridFile = (file) => {
    const displayName = file.name.split('/').pop() || file.name;
    const video = videoByStoragePath[file.name];
    const isSelected = video && isVideoSelected(video.id);
    const playable = video || file.videoUrl;
    const linkable = !!(video || file.videoUrl);
    const linking = linkingPath === file.name;
    return (
      <TouchableOpacity
        key={file.name}
        style={[styles.dirGridItem, styles.fileGridItem, isSelected && styles.selectedGridItem]}
        onPress={() => linkable && handleFileToggle(file)}
        disabled={!linkable || linking}
        activeOpacity={linkable ? 0.7 : 1}
      >
        <View style={styles.gridMedia}>
          {playable ? (
            <TouchableOpacity
              style={styles.gridPlayBtn}
              onPress={() => setPreviewVideo(video || file)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MCIcon name="play" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <MCIcon name="movie-off-outline" size={26} color={colors.textMuted} />
          )}

          <TouchableOpacity
            style={styles.fileMoreBtn}
            onPress={() => setFileActionFor(file)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MCIcon name="dots-vertical" size={18} color="#fff" />
          </TouchableOpacity>

          {linkable ? (
            <TouchableOpacity
              style={styles.gridCheckbox}
              onPress={() => handleFileToggle(file)}
              disabled={linking}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {linking ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <MCIcon
                  name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={isSelected ? colors.primary : colors.white}
                />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.gridMeta}>
          <Text style={styles.dirGridText} numberOfLines={2}>{video ? video.title : displayName}</Text>
          <View style={styles.gridMetaRow}>
            {!!file.size && <Text style={styles.fileSizeText}>{formatBytes(file.size)}</Text>}
            {video?.duration ? (
              <Text style={styles.fileSizeText}>{formatDuration(video.duration)}</Text>
            ) : null}
          </View>
          {!linkable ? (
            <Text style={styles.fileMissingText}>No record</Text>
          ) : (
            <TouchableOpacity
              style={styles.gridEditBtn}
              onPress={() => handleFileEdit(file)}
              disabled={linking}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MCIcon name="pencil-outline" size={12} color={colors.primary} />
              <Text style={styles.gridEditText}>Edit details</Text>
            </TouchableOpacity>
          )}
        </View>
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
          onPress={() => handleToggleFolder(item)}
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

  // Same one-shape-fits-all rule as renderGridFile: checkbox, play and pencil on
  // every row, with the library record created on demand.
  const renderListFile = ({ item }) => {
    const displayName = item.name.split('/').pop() || item.name;
    const video = videoByStoragePath[item.name];
    const isSelected = video && isVideoSelected(video.id);
    const linkable = !!(video || item.videoUrl);
    const linking = linkingPath === item.name;
    return (
      <TouchableOpacity
        style={[styles.dirListItem, isSelected && styles.selectedListItem]}
        onPress={() => linkable && handleFileToggle(item)}
        disabled={!linkable || linking}
        activeOpacity={linkable ? 0.7 : 1}
      >
        {linkable ? (
          linking ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MCIcon
              name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={isSelected ? colors.primary : colors.textMuted}
            />
          )
        ) : (
          <MCIcon name="movie-off-outline" size={22} color={colors.textMuted} />
        )}
        {linkable ? (
          <TouchableOpacity onPress={() => setPreviewVideo(video || item)} style={{ padding: 2 }}>
            <MCIcon name="play-circle-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.dirListText, !video && { color: colors.textMuted }]} numberOfLines={1}>
          {video ? video.title : displayName}
        </Text>
        {!!item.size && <Text style={styles.fileSizeText}>{formatBytes(item.size)}</Text>}
        {video?.duration ? (
          <Text style={styles.fileSizeText}>{formatDuration(video.duration)}</Text>
        ) : null}
        {linkable && (
          <TouchableOpacity
            onPress={() => handleFileEdit(item)}
            disabled={linking}
            style={{ padding: 4 }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MCIcon name="pencil-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.fileMoreBtnList}
          onPress={() => setFileActionFor(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MCIcon name="dots-vertical" size={20} color={colors.textMuted} />
        </TouchableOpacity>
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

            <Text style={styles.smallLabel}>Duration (seconds) <Text style={styles.reqMark}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Auto-detected — edit if needed"
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
                // With Overwrite already on, renaming onto an existing file is
                // the intent — don't re-fail the row for it.
                const clash = existingNames.has(t.toLowerCase().trim()) && !item.overwrite;
                updateItem(item.id, {
                  saveAs: t,
                  status: clash ? 'failed' : 'pending',
                  error: clash ? 'A file with this name already exists — tick Overwrite or pick another name.' : null,
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
        right={items.length === 0 ? (
          <TouchableOpacity
            style={[styles.headerSaveBtn, (!hasChanges || saving) && styles.headerSaveBtnDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.headerText} />
            ) : (
              <MCIcon name="content-save" size={18} color={colors.headerText} />
            )}
            <Text style={styles.headerSaveText}>Save</Text>
          </TouchableOpacity>
        ) : null}
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
            {!!uploadHint && (
              <View style={styles.uploadHintRow}>
                <MCIcon
                  name={pendingProbe ? 'timer-sand' : 'information-outline'}
                  size={14}
                  color={colors.warning}
                />
                <Text style={styles.uploadHintText}>{uploadHint}</Text>
              </View>
            )}
            {items.map(renderQueueItem)}
          </>
        )}

        {items.length === 0 && (
        <>
        {/* Storage Browser */}
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Cloud Storage</Text>
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
        // Slim selection summary. Save now lives in the header, so this bar just
        // reports the count and expands to review/remove picks — freeing the
        // space the full-width Save footer used to take.
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
            {hasChanges && <View style={styles.unsavedDot} />}
            <MCIcon
              name={selectedExpanded ? 'chevron-down' : 'chevron-up'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
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

      {/* Library metadata for an already-stored video */}
      <Modal visible={!!metaEditor} transparent animationType="fade" onRequestClose={() => setMetaEditor(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Video Details</Text>

            <Text style={styles.smallLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Video title"
              placeholderTextColor={colors.textMuted}
              value={metaTitle}
              onChangeText={setMetaTitle}
              editable={!metaSaving}
            />

            <Text style={styles.smallLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Brief description"
              placeholderTextColor={colors.textMuted}
              value={metaDescription}
              onChangeText={setMetaDescription}
              multiline
              editable={!metaSaving}
            />

            <Text style={styles.smallLabel}>Duration (seconds)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 600"
              placeholderTextColor={colors.textMuted}
              value={metaDuration}
              onChangeText={setMetaDuration}
              keyboardType="numeric"
              editable={!metaSaving}
            />
            {metaDuration.trim() && !isNaN(parseInt(metaDuration, 10)) ? (
              <Text style={styles.metaHint}>
                Shows as {formatDuration(parseInt(metaDuration, 10))} in the apps
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => setMetaEditor(null)}
                disabled={metaSaving}
              >
                <Text style={{ color: colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={saveMetaEditor}
                disabled={metaSaving}
              >
                {metaSaving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={{ color: colors.white }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

      {/* Off-screen duration auto-detection for queued uploads */}
      {probeElement}

      {/* Per-file move / delete with dependency check */}
      <StorageFileActionsModal
        file={fileActionFor}
        onClose={() => setFileActionFor(null)}
        onChanged={refreshStorageAndVideos}
      />
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  smallLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
  reqMark: { color: '#EF4444', fontWeight: '800' },
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
  // Rows start at the left edge — a centred wrap left the last (partial) row
  // floating in the middle of the folder, out of line with the rows above it.
  dirsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  // Taller than it is wide: the square tile had no room for the filename plus
  // its size/duration, so the floating controls sat on top of the text.
  dirGridItem: {
    width: '31%', minHeight: 148, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  fileGridItem: { backgroundColor: colors.surfaceMuted, alignItems: 'stretch', justifyContent: 'flex-start', padding: 0, overflow: 'hidden' },
  selectedGridItem: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  // Media box: the only area the floating controls live in, so they can never
  // land on the filename or the metadata below.
  gridMedia: {
    height: 62,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridMeta: { paddingHorizontal: 8, paddingVertical: 6, flex: 1 },
  gridMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  gridCheckbox: { position: 'absolute', top: 4, right: 4 },
  dirGridText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, marginTop: 0, textAlign: 'left' },
  fileSizeText: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  fileMissingText: { fontSize: 9, color: colors.danger, marginTop: 2 },
  gridEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  gridEditText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  metaHint: { fontSize: 11, color: colors.textMuted, marginTop: -4, marginBottom: 8 },

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
  // Per-file move/delete entry point (opens StorageFileActionsModal).
  fileMoreBtn: { position: 'absolute', top: 4, left: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  fileMoreBtnList: { paddingHorizontal: 6, paddingVertical: 4 },
  // Centred in the media box (not floating over the whole tile).
  gridPlayBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
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

  // Header Save action (replaces the old full-width footer button)
  headerSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  headerSaveBtnDisabled: { opacity: 0.45 },
  headerSaveText: { color: colors.headerText, fontSize: 14, fontWeight: '700' },
  // Unsaved marker on the selection bar so the moved-to-header Save stays discoverable.
  unsavedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warning },
  // saveBtn is still used by the Create Directory modal's primary action.
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, padding: 16, borderRadius: 12 },
  uploadHintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  uploadHintText: { fontSize: 12, color: colors.warning, fontWeight: '600' },

  // Upload bottom bar (shown when items queued)
  uploadFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  uploadFooterLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  uploadFooterText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 },
  uploadFooterBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  uploadFooterBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  uploadCancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  uploadCancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.modalSurface, padding: 20, borderRadius: 16 , borderWidth: 1, borderColor: colors.modalBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12},
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  modalOverlayCentered: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 30 },
  targetPickerCard: { backgroundColor: colors.modalSurface, borderRadius: 16, padding: 16, maxWidth: 420, width: '100%'  , borderWidth: 1, borderColor: colors.modalBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12},
  targetSection: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  targetEmpty: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  targetOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10, marginBottom: 2 },
  targetOptionText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  iconPickerCard: { backgroundColor: colors.modalSurface, borderRadius: 16, padding: 16, maxWidth: 400, width: '100%'  , borderWidth: 1, borderColor: colors.modalBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12},
  iconPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  iconPageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8 },
  iconPageText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  iconPageIndicator: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  wellnessIconGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 8 },
  wellnessIconBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surfaceMuted, margin: 5, alignItems: 'center', justifyContent: 'center' },
  wellnessIconBoxSelected: { backgroundColor: colors.primary },
});

export default VideoGroupEditorScreen;
