import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Alert,
  BackHandler,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { WELLNESS_ICONS } from '../constants/icons';
import { DirGridSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import StorageFileActionsModal from '../components/StorageFileActionsModal';
import StorageFolderActionsModal from '../components/StorageFolderActionsModal';
import useDurationProbe from '../hooks/useDurationProbe';
import { showAlert } from '../utils/alert';
import { handlePickFiles as sharedHandlePickFiles, uploadOne as sharedUploadOne, handleUploadAll as sharedHandleUploadAll } from '../utils/UploadHelper';
import { ICONS_PER_PAGE } from '../constants/icons';

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

const STATUS_META = {
  pending: { icon: 'clock-outline', color: '#9CA3AF' },
  uploading: { icon: 'progress-upload', color: '#3B82F6' },
  done: { icon: 'check-circle', color: '#10B981' },
  failed: { icon: 'alert-circle', color: '#EF4444' },
};

const UploadVideoScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const defaultGroupId = route.params?.videoGroupId || null;

  // Storage browser
  const [directories, setDirectories] = useState([]);
  const [dirFiles, setDirFiles] = useState([]);
  const [dirsLoading, setDirsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedDir, setSelectedDir] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [createDirModal, setCreateDirModal] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  // Upload queue: one entry per picked video
  const [items, setItems] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Targets
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [targetPickerFor, setTargetPickerFor] = useState(null); // item id or '__all__'
  const [iconPickerFor, setIconPickerFor] = useState(null);
  const [iconPage, setIconPage] = useState(0);
  const totalIconPages = Math.ceil(WELLNESS_ICONS.length / ICONS_PER_PAGE);

  // Per-file storage actions (move / delete)
  const [fileActionFor, setFileActionFor] = useState(null);
  const [folderActionFor, setFolderActionFor] = useState(null);

  const cancelledRef = useRef(false);
  // Once the user explicitly clears or picks a target, stop auto-following the
  // browsed folder (see the auto-select effect below).
  const selectionTouchedRef = useRef(false);

  useEffect(() => {
    fetchDirectories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Auto-select the folder currently being browsed as the upload target, but
  // only until the user takes control. The explicit "Upload to …" button sits
  // below a long directory list, so on first run we follow navigation as a
  // convenience. The moment the user clears the target (×) or picks one
  // explicitly, `selectionTouchedRef` flips and we stop re-selecting — so a
  // deselect actually sticks instead of the folder re-selecting on every move.
  useEffect(() => {
    if (!selectionTouchedRef.current) setSelectedDir(currentPath || '/');
  }, [currentPath]);

  useEffect(() => {
    apiClient.get(ENDPOINTS.VIDEO_GROUPS)
      .then(res => setGroups((res?.data?.groups || []).filter(g => g.is_active !== false)))
      .catch(() => setGroups([]));
    apiClient.get(ENDPOINTS.ALL_SESSIONS)
      .then(res => setSessions(res?.data?.sessions || []))
      .catch(() => setSessions([]));
    return () => { cancelledRef.current = true; };
  }, []);

  const fetchDirectories = () => {
    setDirsLoading(true);
    const params = currentPath ? { parent: currentPath } : {};
    apiClient.get(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { params })
      .then(res => {
        setDirectories(res?.data?.directories || []);
        setDirFiles(res?.data?.files || []);
      })
      .catch(err => {
        setDirectories([]);
        setDirFiles([]);
        showAlert('Error', err?.message || 'Failed to load storage directories');
      })
      .finally(() => setDirsLoading(false));
  };

  const navigateInto = (dir) => setCurrentPath(dir);

  const navigateBreadcrumb = (index) => {
    const crumbs = currentPath.replace(/\/$/, '').split('/').filter(Boolean);
    const targetParts = crumbs.slice(0, index + 1);
    setCurrentPath(targetParts.length > 0 ? targetParts.join('/') + '/' : '');
  };

  const selectCurrentFolder = () => {
    selectionTouchedRef.current = true;
    setSelectedDir(currentPath || '/');
  };

  const clearSelectedFolder = () => {
    selectionTouchedRef.current = true;
    setSelectedDir('');
  };

  // Where to go when leaving. Opened from a group's editor we return there;
  // opened standalone (from Video Management, no group) we just pop the stack —
  // navigating to VideoGroupEditor with a null groupId would land on a broken
  // editor.
  const leaveScreen = () => {
    if (defaultGroupId) {
      navigation.navigate('VideoGroupEditor', { groupId: defaultGroupId, groupTitle: '' });
    } else {
      navigation.goBack();
    }
  };

  // Step one folder up in the storage browser (empty = root).
  const goUpFolder = () => {
    const parts = currentPath.replace(/\/$/, '').split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length ? parts.join('/') + '/' : '');
  };

  // Back = up one folder while browsing; only leaves the screen at root. This
  // is why the header arrow no longer jumps straight out to Video Management.
  const handleHeaderBack = () => {
    if (currentPath) goUpFolder();
    else leaveScreen();
  };

  // Android hardware back mirrors the header: fold up a level before exiting.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentPath) {
        goUpFolder();
        return true;
      }
      return false;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

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

  // ── Upload queue management ──

  const handlePickFiles = async () => {
    await sharedHandlePickFiles(
      currentPath,
      selectedDir,
      dirFiles,
      defaultGroupId,
      setItems,
      setExpandedId,
      showAlert
    );
  };

  const updateItem = (id, patch) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const targetLabel = (item) => {
    if (item.sessionId) {
      const s = sessions.find(x => x.id === item.sessionId);
      if (s) return `Session: ${s.title}`;
    }
    if (item.groupId) {
      const g = groups.find(x => x.id === item.groupId);
      if (g) return `Group: ${g.title}`;
      return 'Group selected';
    }
    return 'Select group / session...';
  };

  const applyTarget = (target) => {
    // target: { groupId, sessionId }
    if (targetPickerFor === '__all__') {
      setItems(prev => prev.map(it => (it.status === 'done' ? it : { ...it, ...target })));
    } else if (targetPickerFor) {
      updateItem(targetPickerFor, target);
    }
    setTargetPickerFor(null);
  };

  // ── Upload ──

  // Auto-detect duration for newly-picked files, kept required so a failed
  // probe can't slip a 0-second video through.
  const { probeElement, pendingProbe } = useDurationProbe(items, updateItem);

  const readyToUpload = items.some(it => it.status === 'pending');
  const canUpload =
    !uploading &&
    items.length > 0 &&
    readyToUpload &&
    !!selectedDir &&
    items.every(it => it.status === 'done' || (it.title.trim() && it.groupId && parseInt(it.duration, 10) > 0));

  const validationHint = () => {
    if (items.length === 0) return 'Add at least one video file';
    if (!selectedDir) return 'Select a storage folder above';
    const active = items.filter(it => it.status === 'pending');
    if (active.length === 0) return null;
    if (!active.every(it => it.title.trim())) return 'Every video needs a title';
    if (!active.every(it => it.groupId)) return 'Every video needs a group or session';
    if (!active.every(it => parseInt(it.duration, 10) > 0)) {
      return pendingProbe ? 'Detecting duration…' : 'Every video needs a duration (seconds)';
    }
    return null;
  };

  const uploadOne = async (item) => {
    await sharedUploadOne(item, selectedDir);
  };

  const handleUploadAll = async () => {
    const hint = validationHint();
    if (hint) { showAlert('Cannot upload', hint); return; }

    await sharedHandleUploadAll({
      items,
      updateItem,
      setItems,
      setUploading,
      setUploadProgress,
      cancelledRef,
      fetchDirectories,
      showAlert,
      selectedDir,
      uploadOne: sharedUploadOne,
    });
  };

  // ── Renderers ──

  const crumbs = currentPath ? currentPath.replace(/\/$/, '').split('/').filter(Boolean) : [];

  const renderGridDir = (dir) => {
    const displayName = dir.replace(/\/$/, '').split('/').pop() || dir;
    return (
      <TouchableOpacity key={dir} style={styles.dirGridItem} onPress={() => navigateInto(dir)}>
        <MCIcon name="folder" size={28} color={colors.warning} />
        <Text style={styles.dirGridText} numberOfLines={1}>{displayName}</Text>
        <TouchableOpacity
          style={styles.fileMoreBtn}
          onPress={() => setFolderActionFor(dir)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MCIcon name="dots-vertical" size={18} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderGridFile = (file) => {
    const displayName = file.name.split('/').pop() || file.name;
    return (
      <View key={file.name} style={[styles.dirGridItem, styles.fileGridItem]}>
        <MCIcon name="movie-outline" size={26} color={colors.primary} />
        <Text style={styles.dirGridText} numberOfLines={2}>{displayName}</Text>
        {!!file.size && <Text style={styles.fileSizeText}>{formatBytes(file.size)}</Text>}
        <TouchableOpacity
          style={styles.fileMoreBtn}
          onPress={() => setFileActionFor(file)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MCIcon name="dots-vertical" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderListDir = ({ item }) => {
    const displayName = item.replace(/\/$/, '').split('/').pop() || item;
    return (
      <TouchableOpacity style={styles.dirListItem} onPress={() => navigateInto(item)}>
        <MCIcon name="folder" size={22} color={colors.warning} />
        <Text style={styles.dirListText}>{displayName}</Text>
        <TouchableOpacity
          style={styles.fileMoreBtnList}
          onPress={() => setFolderActionFor(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MCIcon name="dots-vertical" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        <MCIcon name="chevron-right" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderListFile = ({ item }) => {
    const displayName = item.name.split('/').pop() || item.name;
    return (
      <View style={styles.dirListItem}>
        <MCIcon name="movie-outline" size={22} color={colors.primary} />
        <Text style={styles.dirListText} numberOfLines={1}>{displayName}</Text>
        {!!item.size && <Text style={styles.fileSizeText}>{formatBytes(item.size)}</Text>}
        <TouchableOpacity
          style={styles.fileMoreBtnList}
          onPress={() => setFileActionFor(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MCIcon name="dots-vertical" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={styles.queueMeta} numberOfLines={1}>
                {item.file.name}{item.file.size ? ` • ${formatBytes(item.file.size)}` : ''}
              </Text>
            </View>
            {item.status === 'failed' && !!item.error && (
              <Text style={styles.queueError} numberOfLines={2}>{item.error}</Text>
            )}
            
            {/* Visible overwrite option */}
            <TouchableOpacity
              style={styles.queueOverwriteRow}
              onPress={(e) => {
                e.stopPropagation();
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
                size={18}
                color={item.overwrite ? colors.warning : colors.textMuted}
              />
              <Text style={[styles.queueOverwriteLabel, item.overwrite && { color: colors.warning }]}>
                Overwrite
              </Text>
            </TouchableOpacity>
          </View>
          {item.status !== 'uploading' && item.status !== 'done' && (
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); removeItem(item.id); }} style={{ padding: 4 }}>
              <MCIcon name="close-circle" size={20} color={colors.danger} />
            </TouchableOpacity>
          )}
          <MCIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.queueBody}>
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

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Group / Session</Text>
                <TouchableOpacity
                  style={styles.pickerInput}
                  disabled={uploading || item.status === 'done'}
                  onPress={() => setTargetPickerFor(item.id)}
                >
                  <MCIcon name={item.sessionId ? 'meditation' : 'folder-outline'} size={18} color={item.groupId ? colors.primary : colors.textMuted} />
                  <Text style={[styles.pickerInputText, !item.groupId && { color: colors.textMuted }]} numberOfLines={1}>
                    {targetLabel(item)}
                  </Text>
                  <MCIcon name="chevron-down" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View>
                <Text style={styles.smallLabel}>Icon</Text>
                <TouchableOpacity
                  style={styles.pickerInput}
                  disabled={uploading || item.status === 'done'}
                  onPress={() => setIconPickerFor(item.id)}
                >
                  <MCIcon name={item.icon} size={20} color={colors.primary} />
                  <MCIcon name="chevron-down" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const hint = validationHint();

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Upload Videos"
        subtitle={currentPath ? currentPath.replace(/\/$/, '') : 'root'}
        onBack={handleHeaderBack}
      />

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* File Picker */}
        <Text style={styles.label}>Video Files</Text>
        <TouchableOpacity style={styles.filePicker} onPress={handlePickFiles} disabled={uploading}>
          <MCIcon name="video-plus" size={32} color={colors.primary} />
          <Text style={styles.filePickerText}>
            {items.length > 0
              ? `${items.length} video${items.length > 1 ? 's' : ''} selected — tap to add more`
              : 'Tap to select one or more video files'}
          </Text>
        </TouchableOpacity>

        {/* Upload queue */}
        {items.length > 0 && (
          <>
            <View style={styles.queueToolbar}>
              <Text style={styles.queueCount}>Videos to upload</Text>
              <TouchableOpacity
                style={styles.applyAllBtn}
                disabled={uploading}
                onPress={() => setTargetPickerFor('__all__')}
              >
                <MCIcon name="playlist-check" size={16} color={colors.primary} />
                <Text style={styles.applyAllText}>Set group for all</Text>
              </TouchableOpacity>
            </View>
            {items.map(renderQueueItem)}
          </>
        )}

        {/* Directory Selection */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={styles.label}>Storage Folder</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
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
          {!!currentPath && (
            <TouchableOpacity style={styles.createDirBtn} onPress={goUpFolder}>
              <MCIcon name="arrow-up-left" size={18} color={colors.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.createDirBtn} onPress={fetchDirectories}>
            <MCIcon name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createDirBtn} onPress={() => setCreateDirModal(true)}>
            <MCIcon name="folder-plus" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Upload-target bar — always visible right under the breadcrumb (no
            scrolling to a buried button). Green when a target is set, amber with
            a one-tap "use this folder" when it's been cleared. */}
        {selectedDir ? (
          <View style={styles.selectedDirBar}>
            <MCIcon name="check-circle" size={18} color="#10B981" />
            <Text style={styles.selectedDirText} numberOfLines={1}>
              Uploading to: {selectedDir === '/' ? 'root' : selectedDir}
            </Text>
            <TouchableOpacity onPress={clearSelectedFolder} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MCIcon name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noTargetBar}>
            <MCIcon name="folder-alert-outline" size={18} color={colors.warning} />
            <Text style={styles.noTargetText} numberOfLines={1}>No upload folder selected</Text>
            <TouchableOpacity style={styles.useThisBtn} onPress={selectCurrentFolder}>
              <MCIcon name="check" size={14} color={colors.white} />
              <Text style={styles.useThisBtnText}>
                Use {currentPath ? `"${currentPath.replace(/\/$/, '').split('/').pop()}"` : 'root'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Directory + file listing */}
        {dirsLoading ? (
          <DirGridSkeleton />
        ) : directories.length === 0 && dirFiles.length === 0 ? (
          <View style={styles.emptyDirs}>
            <MCIcon name="folder-open-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyDirText}>This folder is empty</Text>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.dirsGrid}>
            {directories.map(renderGridDir)}
            {dirFiles.map(renderGridFile)}
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
          </View>
        )}
      </ScrollView>

      {/* Upload / Back / Cancel Footer — only when there's something queued, so
          an empty browser isn't dominated by a full-width Cancel. Leaving with
          nothing queued is the header back button's job. */}
      {items.length > 0 && (
      <View style={styles.footer}>
        {!uploading && !!hint && (
          <Text style={styles.footerHint}>{hint}</Text>
        )}
        <View style={styles.footerRow}>
          {items.some(it => it.status === 'done') ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={leaveScreen}
            >
              <MCIcon name="arrow-left" size={20} color={colors.white} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                if (items.length > 0 && items.some(it => it.status !== 'done')) {
                  Alert.alert(
                    'Cancel Upload',
                    'Are you sure you want to cancel? Your selected videos will be lost.',
                    [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Yes',
                        style: 'destructive',
                        onPress: () => {
                          cancelledRef.current = true;
                          leaveScreen();
                        },
                      },
                    ],
                  );
                } else {
                  leaveScreen();
                }
              }}
            >
              <MCIcon name="close" size={20} color={colors.textMuted} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
          {items.some(it => it.status === 'pending') && (
            <TouchableOpacity
              style={[styles.uploadBtn, !canUpload && { opacity: 0.6 }]}
              onPress={handleUploadAll}
              disabled={!canUpload}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <MCIcon name="cloud-upload" size={22} color={colors.white} />
              )}
              <Text style={styles.uploadBtnText}>
                {uploading
                  ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
                  : `Upload ${items.filter(it => it.status === 'pending').length} Video${items.filter(it => it.status === 'pending').length > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      )}

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

      {/* Target (group/session) picker */}
      <Modal visible={!!targetPickerFor} transparent animationType="fade" onRequestClose={() => setTargetPickerFor(null)}>
        <TouchableOpacity style={styles.modalOverlayCentered} activeOpacity={1} onPress={() => setTargetPickerFor(null)}>
          <View style={styles.targetPickerCard}>
            <Text style={styles.modalTitle}>
              {targetPickerFor === '__all__' ? 'Set target for all videos' : 'Select target'}
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
        onChanged={fetchDirectories}
      />

      {/* Per-folder rename / delete with dependency check */}
      <StorageFolderActionsModal
        folder={folderActionFor}
        onClose={() => setFolderActionFor(null)}
        onChanged={fetchDirectories}
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
  applyAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primaryLight },
  applyAllText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  queueCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, marginBottom: 8, backgroundColor: colors.card, overflow: 'hidden' },
  queueHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  queueTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  queueMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  queueError: { fontSize: 11, color: '#EF4444', marginTop: 2 },
  queueBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border },
  pickerInput: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: colors.card },
  pickerInputText: { flex: 1, fontSize: 13, color: colors.textPrimary },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  viewToggleBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  viewToggleActive: { backgroundColor: colors.primary },

  // Breadcrumb
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' },
  breadcrumbItem: { padding: 4 },
  breadcrumbText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  breadcrumbActive: { color: colors.primary },

  // Selected dir bar
  selectedDirBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, marginBottom: 12,
    backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B98130',
  },
  selectedDirText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#10B981' },

  // Directory grid mode
  dirsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  dirGridItem: {
    width: '30%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  fileGridItem: { backgroundColor: colors.surfaceMuted },
  dirGridText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, marginTop: 6, textAlign: 'center' },
  fileSizeText: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  // Per-file move/delete entry point (opens StorageFileActionsModal).
  fileMoreBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  fileMoreBtnList: { paddingHorizontal: 6, paddingVertical: 4 },

  // Directory list mode
  dirList: { marginBottom: 8 },
  dirListItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10,
  },
  dirListText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },

  // No-target prompt bar (shown when the upload folder has been cleared)
  noTargetBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10, marginBottom: 12,
    backgroundColor: colors.warning + '18', borderWidth: 1, borderColor: colors.warning + '40',
  },
  noTargetText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  useThisBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary,
  },
  useThisBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },

  // Empty state
  emptyDirs: { alignItems: 'center', paddingVertical: 24 },
  emptyDirText: { fontSize: 14, color: colors.textMuted, marginTop: 12 },

  createDirBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },

  footer: { padding: 20, paddingBottom: 32, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  footerHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  footerRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceMuted, flex: 1 },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: colors.textMuted },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16, borderRadius: 12, backgroundColor: colors.primary, flex: 1 },
  backBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, padding: 16, borderRadius: 12, flex: 2 },
  uploadBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  overwriteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingVertical: 6 },
  overwriteLabel: { fontSize: 13, fontWeight: '500', color: colors.textMuted, flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.card, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  saveBtn: { backgroundColor: colors.primary },
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

export default UploadVideoScreen;
