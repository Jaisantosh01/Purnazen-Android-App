import { useState, useRef, useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { titleFromFilename } from '../utils/fileUtils'; // Need to create/check this

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/ogg'];

export const useUploadManager = (defaultGroupId, currentPath, selectedDir, fetchDirectories) => {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const cancelledRef = useRef(false);

  const updateItem = (id, patch) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handlePickFiles = async (showAlert, dirFiles) => {
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
      setItems(prev => [...prev, ...newItems]);
      return newItems; // Return to allow screen-specific logic (e.g. setExpandedId)
    } catch (err) {
      showAlert('Error', 'Failed to pick video files');
    }
  };

  const uploadOne = async (item, selectedDir) => {
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

  const handleUploadAll = async (showAlert, selectedDir, currentPath, validationHint) => {
    const hint = validationHint();
    if (hint) { showAlert('Cannot upload', hint); return; }

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
        const backendMsg = err?.message || '';
        const isDuplicate = backendMsg.includes('already exists');
        const errorText = backendMsg || 'Upload failed';
        const suggestion = isDuplicate ? ' Enable Overwrite checkbox for this video to replace the existing file.' : '';
        updateItem(item.id, {
          status: 'failed',
          error: errorText + suggestion,
        });
      }
    }
    setUploading(false);
    fetchDirectories();
    if (failed === 0) {
      showAlert('Success', `${pendingItems.length} video${pendingItems.length > 1 ? 's' : ''} uploaded successfully`);
    } else if (failed === pendingItems.length) {
      showAlert('Upload failed', `All ${failed} video${failed > 1 ? 's' : ''} failed to upload.`);
    } else {
      showAlert('Upload finished', `${pendingItems.length - failed} succeeded, ${failed} failed.`);
    }
  };

  return { items, setItems, uploading, setUploading, uploadProgress, cancelledRef, handlePickFiles, handleUploadAll, updateItem, removeItem };
};
