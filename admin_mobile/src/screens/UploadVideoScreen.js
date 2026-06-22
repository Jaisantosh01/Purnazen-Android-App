import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
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
import { COLORS } from '../constants/theme';
import { WELLNESS_ICONS } from '../constants/icons';
import { DirGridSkeleton } from '../components/SkeletonLoader';

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/ogg'];

const UploadVideoScreen = ({ route, navigation }) => {
  const { videoGroupId } = route.params;

  const [directories, setDirectories] = useState([]);
  const [dirsLoading, setDirsLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState([]);
  const [selectedDir, setSelectedDir] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const [createDirModal, setCreateDirModal] = useState(false);
  const [newDirName, setNewDirName] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [icon, setIcon] = useState('play-circle');
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchDirectories(); }, [currentPath]);

  const fetchDirectories = () => {
    setDirsLoading(true);
    const params = currentPath ? { parent: currentPath } : {};
    apiClient.get(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { params })
      .then(res => setDirectories(res?.data?.directories || []))
      .catch(() => setDirectories([]))
      .finally(() => setDirsLoading(false));
  };

  const navigateInto = (dir) => {
    setPathHistory(prev => [...prev, currentPath]);
    setCurrentPath(dir);
    setSelectedDir('');
  };

  const navigateBack = () => {
    const prev = [...pathHistory];
    const parent = prev.pop();
    setPathHistory(prev);
    setCurrentPath(parent || '');
    setSelectedDir('');
  };

  const navigateBreadcrumb = (index) => {
    const crumbs = currentPath.replace(/\/$/, '').split('/').filter(Boolean);
    const targetParts = crumbs.slice(0, index + 1);
    const targetPath = targetParts.length > 0 ? targetParts.join('/') + '/' : '';
    setPathHistory([]);
    setCurrentPath(targetPath);
    setSelectedDir('');
  };

  const selectCurrentFolder = () => {
    setSelectedDir(currentPath);
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (file) {
        const mime = (file.mimeType || '').toLowerCase();
        const isVideo = mime.startsWith('video/') || VIDEO_MIME_TYPES.includes(mime);
        if (!isVideo) {
          Alert.alert('Invalid file', 'Only video files are allowed');
          return;
        }
        setSelectedFile(file);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick video file');
    }
  };

  const handleCreateDir = () => {
    const name = newDirName.trim();
    if (!name) { Alert.alert('Error', 'Enter a directory name'); return; }
    const path = currentPath + (name.endsWith('/') ? name : name + '/');
    apiClient.post(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { path })
      .then(() => {
        setCreateDirModal(false);
        setNewDirName('');
        fetchDirectories();
      })
      .catch(() => Alert.alert('Error', 'Failed to create directory'));
  };

  const handleUpload = async () => {
    if (!selectedFile) { Alert.alert('Error', 'Select a video file'); return; }
    if (!selectedDir) { Alert.alert('Error', 'Select a storage directory'); return; }
    if (!title.trim()) { Alert.alert('Error', 'Enter a video title'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        type: selectedFile.mimeType || 'video/mp4',
        name: selectedFile.name || 'video.mp4',
      });
      formData.append('directory', selectedDir);
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('duration', String(parseInt(duration) || 0));
      formData.append('icon', icon);
      formData.append('video_group_id', videoGroupId);
      formData.append('sort_order', '0');

      await apiClient.post(ENDPOINTS.VIDEO_UPLOAD, formData, { timeout: 300000 });

      Alert.alert('Success', 'Video uploaded successfully');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const crumbs = currentPath ? currentPath.replace(/\/$/, '').split('/').filter(Boolean) : [];

  const renderGridDir = (dir) => {
    const displayName = dir.replace(/\/$/, '').split('/').pop() || dir;
    return (
      <TouchableOpacity
        key={dir}
        style={styles.dirGridItem}
        onPress={() => navigateInto(dir)}
      >
        <MCIcon name="folder" size={28} color={COLORS.warning} />
        <Text style={styles.dirGridText} numberOfLines={1}>{displayName}</Text>
      </TouchableOpacity>
    );
  };

  const renderListDir = ({ item }) => {
    const displayName = item.replace(/\/$/, '').split('/').pop() || item;
    return (
      <TouchableOpacity style={styles.dirListItem} onPress={() => navigateInto(item)}>
        <MCIcon name="folder" size={22} color={COLORS.warning} />
        <Text style={styles.dirListText}>{displayName}</Text>
        <MCIcon name="chevron-right" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Video</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* File Picker */}
        <Text style={styles.label}>Video File</Text>
        <TouchableOpacity style={styles.filePicker} onPress={handlePickFile}>
          <MCIcon name="video-plus" size={32} color={COLORS.primary} />
          <Text style={styles.filePickerText}>
            {selectedFile ? selectedFile.name : 'Tap to select a video file'}
          </Text>
          {selectedFile && (
            <TouchableOpacity onPress={() => setSelectedFile(null)}>
              <MCIcon name="close-circle" size={22} color={COLORS.danger} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Directory Selection */}
        <View style={styles.sectionHeader}>
          <Text style={styles.label}>Storage Directory</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleActive]}
              onPress={() => setViewMode('grid')}
            >
              <MCIcon name="grid" size={18} color={viewMode === 'grid' ? COLORS.white : COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleActive]}
              onPress={() => setViewMode('list')}
            >
              <MCIcon name="format-list-bulleted" size={18} color={viewMode === 'list' ? COLORS.white : COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Breadcrumb */}
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity style={styles.breadcrumbItem} onPress={() => { setPathHistory([]); setCurrentPath(''); setSelectedDir(''); }}>
            <MCIcon name="home" size={16} color={COLORS.primary} />
          </TouchableOpacity>
          {crumbs.map((part, i) => (
            <React.Fragment key={i}>
              <MCIcon name="chevron-right" size={14} color={COLORS.textMuted} />
              <TouchableOpacity onPress={() => navigateBreadcrumb(i)}>
                <Text style={[styles.breadcrumbText, i === crumbs.length - 1 && styles.breadcrumbActive]}>{part}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.createDirBtn} onPress={fetchDirectories}>
            <MCIcon name="refresh" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createDirBtn} onPress={() => setCreateDirModal(true)}>
            <MCIcon name="folder-plus" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Selected directory indicator */}
        {selectedDir ? (
          <View style={styles.selectedDirBar}>
            <MCIcon name="check-circle" size={18} color="#10B981" />
            <Text style={styles.selectedDirText}>Uploading to: {selectedDir}</Text>
            <TouchableOpacity onPress={() => setSelectedDir('')}>
              <MCIcon name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Directory listing */}
        {dirsLoading ? (
          <DirGridSkeleton />
        ) : directories.length === 0 ? (
          <View style={styles.emptyDirs}>
            <MCIcon name="folder-open-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyDirText}>This folder is empty</Text>
            <TouchableOpacity style={styles.useCurrentBtn} onPress={selectCurrentFolder}>
              <MCIcon name="check" size={18} color={COLORS.white} />
              <Text style={styles.useCurrentBtnText}>Use this folder</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.dirsGrid}>
            {directories.map(renderGridDir)}
          </View>
        ) : (
          <FlatList
            data={directories}
            keyExtractor={item => item}
            renderItem={renderListDir}
            scrollEnabled={false}
            style={styles.dirList}
          />
        )}

        {directories.length > 0 && (
          <TouchableOpacity style={styles.useCurrentBtn} onPress={selectCurrentFolder}>
            <MCIcon name="check" size={18} color={COLORS.white} />
            <Text style={styles.useCurrentBtnText}>
              {currentPath ? `Upload to "${currentPath.replace(/\/$/, '').split('/').pop()}"` : 'Upload to root'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Video Details */}
        <Text style={[styles.label, { marginTop: 20 }]}>Title</Text>
        <TextInput style={styles.input} placeholder="Video title" value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="Brief description" value={description} onChangeText={setDescription} multiline />

        <Text style={styles.label}>Duration (seconds)</Text>
        <TextInput style={styles.input} placeholder="e.g. 600" value={duration} onChangeText={setDuration} keyboardType="numeric" />

        <Text style={styles.label}>Icon</Text>
        <TouchableOpacity style={styles.iconInput} onPress={() => setIconModalVisible(true)}>
          <MCIcon name={icon} size={24} color={COLORS.primary} />
          <Text style={{ flex: 1, marginLeft: 10 }}>{icon}</Text>
          <MCIcon name="chevron-down" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      {/* Upload Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.uploadBtn, (uploading || !selectedDir) && { opacity: 0.6 }]}
          onPress={handleUpload}
          disabled={uploading || !selectedDir}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <MCIcon name="cloud-upload" size={22} color={COLORS.white} />
          )}
          <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Upload Video'}</Text>
        </TouchableOpacity>
      </View>

      {/* Create Directory Modal */}
      <Modal visible={createDirModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              New Folder in {currentPath ? `"${currentPath.replace(/\/$/, '').split('/').pop()}"` : 'root'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Folder name"
              value={newDirName}
              onChangeText={setNewDirName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setCreateDirModal(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleCreateDir}><Text style={{ color: COLORS.white }}>Create</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Icon Selector Modal */}
      <Modal visible={iconModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlayCentered} activeOpacity={1} onPress={() => setIconModalVisible(false)}>
          <View style={styles.iconPickerCard}>
            <View style={styles.wellnessIconGrid}>
              {WELLNESS_ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.wellnessIconBox, icon === ic && styles.wellnessIconBoxSelected]}
                  onPress={() => { setIcon(ic); setIconModalVisible(false); }}
                >
                  <MCIcon name={ic} size={26} color={icon === ic ? COLORS.white : COLORS.textPrimary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, padding: 20, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 14, color: COLORS.textPrimary },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  filePicker: {
    borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed', borderRadius: 12,
    padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    backgroundColor: COLORS.primaryLight,
  },
  filePickerText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  viewToggleBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted },
  viewToggleActive: { backgroundColor: COLORS.primary },

  // Breadcrumb
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' },
  breadcrumbItem: { padding: 4 },
  breadcrumbText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  breadcrumbActive: { color: COLORS.primary },

  // Selected dir bar
  selectedDirBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, marginBottom: 12,
    backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B98130',
  },
  selectedDirText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#10B981' },

  // Directory grid mode
  dirsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dirGridItem: {
    width: '30%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, borderColor: '#EEE',
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', padding: 8,
  },
  dirGridText: { fontSize: 11, fontWeight: '600', color: COLORS.textPrimary, marginTop: 6, textAlign: 'center' },

  // Directory list mode
  dirList: { marginBottom: 8 },
  dirListItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 10,
  },
  dirListText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },

  // Use current folder btn
  useCurrentBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primary, marginTop: 8,
  },
  useCurrentBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.white },

  // Empty state
  emptyDirs: { alignItems: 'center', paddingVertical: 24 },
  emptyDirText: { fontSize: 14, color: COLORS.textMuted, marginTop: 12, marginBottom: 16 },

  createDirBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight },

  iconInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EEE', borderRadius: 8, padding: 12, marginBottom: 12 },
  footer: { padding: 20, paddingBottom: 32, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, padding: 16, borderRadius: 12 },
  uploadBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: '#EEE' },
  saveBtn: { backgroundColor: COLORS.primary },
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconPickerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, maxWidth: 400, width: '100%' },
  wellnessIconGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 8 },
  wellnessIconBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#f0f0f0', margin: 5, alignItems: 'center', justifyContent: 'center' },
  wellnessIconBoxSelected: { backgroundColor: COLORS.primary },
});

export default UploadVideoScreen;
