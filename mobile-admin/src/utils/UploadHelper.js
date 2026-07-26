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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A transient failure is one where the request never got a reply from the
// server — a dropped connection, DNS/TLS hiccup or client-side abort. Those are
// the "first upload fails, next one works" cases and are safe to retry. A real
// HTTP response (e.g. 409 duplicate, 400 bad file) is NOT transient — retrying
// would just fail the same way, so we surface it immediately.
const isTransientUploadError = (err) => {
  if (err?.response) return false;
  const code = err?.code;
  const msg = (err?.message || '').toLowerCase();
  return (
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK' ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('aborted') ||
    // apiClient normalizes no-response failures to this prefix
    msg.includes('did not reach the server')
  );
};

const buildUploadForm = (item, selectedDir) => {
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
  return formData;
};

// Number of extra attempts after the first, for transient network failures.
const UPLOAD_MAX_RETRIES = 2;

// Resolves to the created/updated Video record so the caller can fold it into
// local state (the group editor needs its id to keep the new upload selected).
export const uploadOne = async (item, selectedDir) => {
  let attempt = 0;
  // A fresh FormData per attempt: an already-consumed multipart body can't be
  // replayed on React Native, so reusing one is itself a source of the
  // mysterious second-attempt failures.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await apiClient.post(ENDPOINTS.VIDEO_UPLOAD, buildUploadForm(item, selectedDir), {
        timeout: 600000,
        headers: { 'Content-Type': null },
      });
      return res?.data || null;
    } catch (err) {
      const transient = isTransientUploadError(err);
      // Surface the real cause — these used to fail with no trace in the logs.
      console.warn(
        `[upload] "${item.saveAs || item.file?.name}" attempt ${attempt + 1} failed` +
          ` (transient=${transient}, code=${err?.code || 'n/a'}): ${err?.message || err}`,
      );
      if (transient && attempt < UPLOAD_MAX_RETRIES) {
        attempt += 1;
        await sleep(1000 * attempt); // 1s, then 2s backoff
        continue;
      }
      throw err;
    }
  }
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
  onUploaded,
}) => {
  const pendingItems = items.filter(it => it.status === 'pending');
  if (pendingItems.length === 0) return;

  // The cancel flag is sticky: it is set when the screen unmounts and by the
  // Cancel button, and nothing ever cleared it. A screen that had been left and
  // reopened therefore bailed out of the loop straight after the first request
  // — the file uploaded, but `uploading` was never turned back off and the
  // button sat on "Uploading 1/1…" forever. Starting a run clears it.
  if (cancelledRef) cancelledRef.current = false;

  setUploading(true);
  setUploadProgress({ current: 0, total: pendingItems.length });

  let failed = 0;
  let cancelled = false;
  const uploaded = [];
  try {
    for (let i = 0; i < pendingItems.length; i++) {
      if (cancelledRef?.current) { cancelled = true; break; }
      const item = pendingItems[i];
      setUploadProgress({ current: i + 1, total: pendingItems.length });
      updateItem(item.id, { status: 'uploading', error: null });
      try {
        const video = await uploadOne(item, selectedDir);
        // The file did land server-side, so mark it done even if we're stopping.
        updateItem(item.id, { status: 'done' });
        if (video) uploaded.push(video);
        if (cancelledRef?.current) { cancelled = true; break; }
      } catch (err) {
        if (cancelledRef?.current) { cancelled = true; break; }
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
  } finally {
    // Always release the button, including on the cancel paths — this is what
    // kept the screen stuck in the uploading state.
    setUploading(false);
  }

  // The backend maps each upload into item.groupId as it creates the record;
  // hand the new records back so the caller's local state agrees with it.
  if (uploaded.length) onUploaded?.(uploaded);

  if (cancelled) return;

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
