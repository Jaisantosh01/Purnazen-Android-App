import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { titleFromFilename } from './fileUtils';

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/ogg'];

export const handlePickFiles = async (
  currentPath,
  selectedDir,
  dirFiles,
  defaultGroupId,
  setItems,
  setExpandedId,
  showAlert
) => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const assets = result.assets || [];
    const videos = assets.filter(f => {
      const mime = (f.mimeType || '').toLowerCase();
      return mime.startsWith('video/') || VIDEO_MIME_TYPES.includes(mime);
    });
    if (videos.length < assets.length) {
      showAlert('Some files skipped', 'Only video files are allowed');
    }
    if (videos.length === 0) return;

    let freshList = [];
    try {
      const checkPath = selectedDir || currentPath;
      const targetDir = checkPath === '/' ? '' : checkPath;
      const params = targetDir ? { parent: targetDir } : {};
      const dirRes = await apiClient.get(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { params });
      freshList = dirRes?.data?.files || [];
    } catch {
      freshList = dirFiles;
    }
    const existingNames = new Set(freshList.map(f => (f.name || '').split('/').pop()?.toLowerCase().trim()));

    const newItems = videos.map((file, i) => {
      const saveAs = file.name || `video_${i}.mp4`;
      const isDup = existingNames.has(saveAs.toLowerCase().trim());
      return {
        id: `${Date.now()}_${i}_${file.name}`,
        file,
        saveAs,
        title: titleFromFilename(file.name),
        description: '',
        duration: '',
        icon: 'play-circle',
        groupId: defaultGroupId,
        sessionId: null,
        overwrite: false,
        status: isDup ? 'failed' : 'pending',
        error: isDup ? `"${saveAs}" already exists in this folder.` : null,
      };
    });
    setItems(prev => {
      const updated = [...prev];
      for (const newItem of newItems) {
        const existingIdx = updated.findIndex(
          it => it.status === 'failed' && it.file?.name === newItem.file?.name
        );
        if (existingIdx >= 0) {
          updated[existingIdx] = newItem;
        } else {
          updated.push(newItem);
        }
      }
      return updated;
    });
    if (newItems.length === 1) setExpandedId(newItems[0].id);
  } catch (err) {
    showAlert('Error', 'Failed to pick video files');
  }
};

export const uploadOne = async (item, selectedDir) => {
  const formData = new FormData();
  formData.append('file', {
    uri: item.file.uri,
    type: item.file.mimeType || 'video/mp4',
    name: item.saveAs || item.file.name || 'video.mp4',
  });
  formData.append('directory', selectedDir === '/' ? '' : selectedDir);
  formData.append('title', item.title.trim());
  formData.append('description', item.description.trim());
  formData.append('duration', String(parseInt(item.duration, 10) || 0));
  formData.append('icon', item.icon);
  formData.append('video_group_id', item.groupId);
  formData.append('sort_order', '0');
  formData.append('overwrite', item.overwrite ? 'true' : 'false');
  await apiClient.post(ENDPOINTS.VIDEO_UPLOAD, formData, {
    timeout: 600000,
    headers: { 'Content-Type': null },
  });
};

export const handleUploadAll = async ({
  items,
  updateItem,
  setItems,
  setUploading,
  setUploadProgress,
  cancelledRef,
  fetchDirectories,
  showAlert,
  selectedDir,
  uploadOne,
}) => {
  const pendingItems = items.filter(it => it.status === 'pending');
  if (pendingItems.length === 0) return;

  setUploading(true);
  setUploadProgress({ current: 0, total: pendingItems.length });

  let failed = 0;
  for (let i = 0; i < pendingItems.length; i++) {
    if (cancelledRef.current) return;
    const item = pendingItems[i];
    setUploadProgress({ current: i + 1, total: pendingItems.length });
    updateItem(item.id, { status: 'uploading', error: null });
    try {
      await uploadOne(item, selectedDir);
      if (cancelledRef.current) return;
      updateItem(item.id, { status: 'done' });
    } catch (err) {
      if (cancelledRef.current) return;
      failed++;
      const backendMsg = err?.response?.data?.message || err?.message || '';
      const isDuplicate = backendMsg.includes('already exists');
      const errorText = isDuplicate ? 'A file with the same name already exists in this folder. Rename it or enable Overwrite.' : (backendMsg || 'Upload failed');
      updateItem(item.id, {
        status: 'failed',
        error: errorText,
      });
    }
  }

  setUploading(false);
  fetchDirectories();
  if (failed === 0) {
    setItems([]);
    showAlert('Success', `${pendingItems.length} video${pendingItems.length > 1 ? 's' : ''} uploaded successfully`);
  } else if (failed === pendingItems.length) {
    showAlert('Upload failed', `All ${failed} video${failed > 1 ? 's' : ''} failed to upload. Check the error details and try again.`);
  } else {
    showAlert('Upload finished', `${pendingItems.length - failed} succeeded, ${failed} failed. Fix the errors below and tap Upload to retry.`);
  }
};
