import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import { showAlert, showConfirm } from '../utils/alert';

/**
 * Per-file actions for a stored video: Move to another folder, Rename, Delete.
 *
 * On open it loads which groups/sessions reference the file so every
 * relocating/destructive action can spell out what carries over first. Moving
 * and renaming keep every mapping intact — the backend only repoints the blob
 * path — and a rename also refreshes the catalog title so the change shows up
 * everywhere the video appears, not just in the storage browser.
 *
 * `file` is the storage file object ({ name, size, videoUrl }) or null to hide.
 * `name` is the raw blob path the endpoints key on. `onChanged` fires after a
 * successful action so the parent can refresh storage + catalog.
 */
const dirOf = (path) => {
  const i = (path || '').lastIndexOf('/');
  return i >= 0 ? path.slice(0, i + 1) : '';
};
const leaf = (path) => (path || '').replace(/\/$/, '').split('/').pop() || path;
const parentDir = (path) => {
  const parts = (path || '').replace(/\/$/, '').split('/').filter(Boolean);
  parts.pop();
  return parts.length ? parts.join('/') + '/' : '';
};

const StorageFileActionsModal = ({ file, onClose, onChanged }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [info, setInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [view, setView] = useState('menu'); // 'menu' | 'move' | 'rename'
  const [busy, setBusy] = useState(false);

  // Move: a small navigable folder browser + a confirm step.
  const [browsePath, setBrowsePath] = useState('');
  const [browseDirs, setBrowseDirs] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [moveTarget, setMoveTarget] = useState('');

  // Move: inline "new folder" creation inside the browser.
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  // Rename: edit the base name only; the extension is fixed.
  const [renameValue, setRenameValue] = useState('');

  const path = file?.name || '';
  const fileName = leaf(path);
  const currentDir = dirOf(path);
  const currentDirLabel = currentDir ? leaf(currentDir) : 'root';
  const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
  const baseName = ext ? fileName.slice(0, -ext.length) : fileName;

  useEffect(() => {
    if (!file) {
      setInfo(null);
      setView('menu');
      setBusy(false);
      setConfirming(false);
      setBrowseDirs([]);
      setCreatingFolder(false);
      setFolderName('');
      return;
    }
    setRenameValue(baseName);
    setInfoLoading(true);
    apiClient
      .get(ENDPOINTS.VIDEO_STORAGE_FILE_INFO, { params: { path } })
      .then((res) => setInfo(res?.data || null))
      .catch(() => setInfo(null))
      .finally(() => setInfoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const deps = info?.dependencies;
  const usedIn = [
    ...(deps?.groups || []).map((g) => g.title),
    ...(deps?.sessions || []).map((s) => s.title),
  ];

  const afterChange = (message) => {
    onChanged?.();
    onClose?.();
    showAlert('Done', message);
  };

  const loadBrowse = (p) => {
    setBrowsePath(p);
    setBrowseLoading(true);
    apiClient
      .get(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { params: p ? { parent: p } : {} })
      .then((res) => setBrowseDirs(res?.data?.directories || []))
      .catch(() => setBrowseDirs([]))
      .finally(() => setBrowseLoading(false));
  };

  const enterMoveMode = () => {
    setView('move');
    setConfirming(false);
    setMoveTarget('');
    setCreatingFolder(false);
    setFolderName('');
    loadBrowse('');
  };

  const createFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    setFolderBusy(true);
    apiClient
      .post(ENDPOINTS.VIDEO_STORAGE_FOLDER_CREATE, { parent: browsePath, name })
      .then(() => {
        setFolderBusy(false);
        setCreatingFolder(false);
        setFolderName('');
        loadBrowse(browsePath); // reveal the new subfolder at this level
        onChanged?.(); // storage changed under the hood
      })
      .catch((err) => {
        setFolderBusy(false);
        showAlert('Could not create folder', err?.message || 'Try a different name.');
      });
  };

  const doMove = () => {
    setBusy(true);
    apiClient
      .post(ENDPOINTS.VIDEO_STORAGE_MOVE, { src_path: path, dst_directory: moveTarget })
      .then((res) => afterChange(res?.message || 'File moved.'))
      .catch((err) => {
        setBusy(false);
        showAlert('Move failed', err?.message || 'Could not move the file.');
      });
  };

  const doRename = () => {
    setBusy(true);
    apiClient
      .post(ENDPOINTS.VIDEO_STORAGE_RENAME, { src_path: path, new_name: renameValue.trim() })
      .then((res) => afterChange(res?.message || 'File renamed.'))
      .catch((err) => {
        setBusy(false);
        showAlert('Rename failed', err?.message || 'Could not rename the file.');
      });
  };

  const doDelete = () => {
    const usedLine = usedIn.length ? `\n\nStill used by: ${usedIn.join(', ')}.` : '';
    showConfirm(
      'Delete video',
      `Permanently delete "${fileName}" and its file from storage? This cannot be undone.${usedLine}`,
      () => {
        setBusy(true);
        apiClient
          .delete(ENDPOINTS.VIDEO_STORAGE_DELETE_FILE, { params: { path, hard: true } })
          .then(() => afterChange(`"${fileName}" was deleted.`))
          .catch((err) => {
            setBusy(false);
            if (err?.message && /history/i.test(err.message)) {
              showConfirm(
                'Cannot delete permanently',
                err.message,
                () => {
                  setBusy(true);
                  apiClient
                    .delete(ENDPOINTS.VIDEO_STORAGE_DELETE_FILE, { params: { path, hard: false } })
                    .then(() => afterChange(`"${fileName}" was disabled and hidden from the apps.`))
                    .catch((e2) => {
                      setBusy(false);
                      showAlert('Error', e2?.message || 'Failed to disable video.');
                    });
                },
                { confirmLabel: 'Disable instead' },
              );
              return;
            }
            showAlert('Delete failed', err?.message || 'Could not delete the file.');
          });
      },
      { confirmLabel: 'Delete', destructive: true },
    );
  };

  const CarryOverNote = ({ withTitle }) => (
    <View style={styles.noteBox}>
      <MCIcon name="information-outline" size={16} color={colors.primary} />
      <Text style={styles.noteText}>
        {usedIn.length
          ? `Mappings are kept — it stays in ${usedIn.join(', ')}.`
          : 'Not used by any group or session yet.'}
        {withTitle ? ' The video’s name updates everywhere it appears.' : ' Nothing else changes.'}
      </Text>
    </View>
  );

  const renderHeader = (title, onBack) => (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MCIcon name="arrow-left" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <MCIcon name="movie-outline" size={22} color={colors.primary} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MCIcon name="close" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  const sameFolder = browsePath === currentDir;

  return (
    <Modal visible={!!file} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {/* ── MENU ── */}
          {view === 'menu' && (
            <>
              {renderHeader(fileName)}
              {infoLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Checking usage…</Text>
                </View>
              ) : (
                <View style={styles.depBox}>
                  <View style={styles.depRow}>
                    <MCIcon name="folder-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.depText}>In folder: {currentDirLabel}</Text>
                  </View>
                  <View style={styles.depRow}>
                    <MCIcon name="folder-multiple-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.depText}>
                      {usedIn.length ? `Used by: ${usedIn.join(', ')}` : 'Not in any group or session'}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.menuRow}>
                <TouchableOpacity style={styles.menuBtn} disabled={busy} onPress={enterMoveMode}>
                  <MCIcon name="folder-move-outline" size={22} color={colors.primary} />
                  <Text style={styles.menuBtnText}>Move</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuBtn} disabled={busy} onPress={() => setView('rename')}>
                  <MCIcon name="rename-box" size={22} color={colors.primary} />
                  <Text style={styles.menuBtnText}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuBtn} disabled={busy} onPress={doDelete}>
                  <MCIcon name="delete-outline" size={22} color="#EF4444" />
                  <Text style={[styles.menuBtnText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── MOVE: navigable folder browser ── */}
          {view === 'move' && !confirming && (
            <>
              {renderHeader('Move to…', () => setView('menu'))}

              <View style={styles.locationRow}>
                <TouchableOpacity
                  style={[styles.locUpBtn, !browsePath && styles.locUpBtnDisabled]}
                  disabled={!browsePath}
                  onPress={() => loadBrowse(parentDir(browsePath))}
                >
                  <MCIcon name="arrow-up-left" size={18} color={browsePath ? colors.primary : colors.textMuted} />
                </TouchableOpacity>
                <MCIcon name="folder-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.locationText} numberOfLines={1}>
                  {browsePath ? browsePath.replace(/\/$/, '') : 'root'}
                </Text>
              </View>

              {creatingFolder ? (
                <View style={styles.newFolderRow}>
                  <MCIcon name="folder-plus-outline" size={18} color={colors.primary} />
                  <TextInput
                    style={styles.newFolderInput}
                    value={folderName}
                    onChangeText={setFolderName}
                    placeholder="New folder name"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                    autoCapitalize="words"
                    onSubmitEditing={createFolder}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={createFolder}
                    disabled={folderBusy || !folderName.trim()}
                    style={styles.newFolderGo}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {folderBusy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <MCIcon name="check" size={20} color={folderName.trim() ? colors.primary : colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setCreatingFolder(false); setFolderName(''); }}
                    style={styles.newFolderGo}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MCIcon name="close" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.newFolderBtn} onPress={() => setCreatingFolder(true)}>
                  <MCIcon name="folder-plus-outline" size={18} color={colors.primary} />
                  <Text style={styles.newFolderBtnText}>New folder here</Text>
                </TouchableOpacity>
              )}

              {browseLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
              ) : (
                <ScrollView style={styles.dirList}>
                  {browseDirs.length === 0 && <Text style={styles.emptyDirs}>No subfolders here.</Text>}
                  {browseDirs.map((d) => (
                    <TouchableOpacity key={d} style={styles.dirOption} onPress={() => loadBrowse(d)}>
                      <MCIcon name="folder-outline" size={20} color={colors.warning} />
                      <Text style={styles.dirOptionText} numberOfLines={1}>{leaf(d)}</Text>
                      {d === currentDir && <Text style={styles.hereTag}>current</Text>}
                      <MCIcon name="chevron-right" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, styles.moveHereBtn, sameFolder && styles.btnBusy]}
                disabled={sameFolder}
                onPress={() => { setMoveTarget(browsePath); setConfirming(true); }}
              >
                <MCIcon name="folder-move-outline" size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>
                  {sameFolder ? 'File is already here' : `Move to "${browsePath ? leaf(browsePath) : 'root'}"`}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── MOVE: confirm ── */}
          {view === 'move' && confirming && (
            <>
              {renderHeader('Confirm move', () => setConfirming(false))}
              <Text style={styles.summaryLabel}>{fileName}</Text>
              <View style={styles.pathRow}>
                <View style={styles.pathChip}><Text style={styles.pathChipText}>{currentDirLabel}</Text></View>
                <MCIcon name="arrow-right" size={18} color={colors.textMuted} />
                <View style={[styles.pathChip, styles.pathChipTarget]}>
                  <Text style={[styles.pathChipText, { color: colors.white }]}>
                    {moveTarget ? leaf(moveTarget) : 'root'}
                  </Text>
                </View>
              </View>
              <CarryOverNote />
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.secondaryBtn} disabled={busy} onPress={() => setConfirming(false)}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, busy && styles.btnBusy]} disabled={busy} onPress={doMove}>
                  {busy ? <ActivityIndicator size="small" color={colors.white} /> : <MCIcon name="check" size={18} color={colors.white} />}
                  <Text style={styles.primaryBtnText}>Move here</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── RENAME ── */}
          {view === 'rename' && (
            <>
              {renderHeader('Rename file', () => setView('menu'))}
              <Text style={styles.fieldLabel}>New name</Text>
              <View style={styles.renameRow}>
                <TextInput
                  style={styles.renameInput}
                  value={renameValue}
                  onChangeText={setRenameValue}
                  placeholder="file name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoFocus
                />
                {!!ext && (
                  <View style={styles.extChip}>
                    <Text style={styles.extChipText}>{ext}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.extHint}>The {ext || 'file'} extension can’t be changed.</Text>
              <CarryOverNote withTitle />
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.secondaryBtn} disabled={busy} onPress={() => setView('menu')}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, (busy || !renameValue.trim() || renameValue.trim() === baseName) && styles.btnBusy]}
                  disabled={busy || !renameValue.trim() || renameValue.trim() === baseName}
                  onPress={doRename}
                >
                  {busy ? <ActivityIndicator size="small" color={colors.white} /> : <MCIcon name="check" size={18} color={colors.white} />}
                  <Text style={styles.primaryBtnText}>Rename</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, width: '100%', maxWidth: 420 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    title: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    loadingText: { fontSize: 13, color: colors.textMuted },
    spinner: { marginVertical: 20 },

    depBox: { backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: 12, gap: 8, marginBottom: 14 },
    depRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    depText: { flex: 1, fontSize: 12.5, color: colors.textSecondary },

    menuRow: { flexDirection: 'row', gap: 10 },
    menuBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surfaceMuted },
    menuBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, marginBottom: 4 },
    locUpBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    locUpBtnDisabled: { backgroundColor: colors.surfaceMuted },
    locationText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary },

    newFolderBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed', marginBottom: 8 },
    newFolderBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    newFolderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, marginBottom: 8 },
    newFolderInput: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.card },
    newFolderGo: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },

    dirList: { maxHeight: 240, marginBottom: 12 },
    dirOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    dirOptionText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    hereTag: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
    emptyDirs: { fontSize: 13, color: colors.textMuted, paddingVertical: 16, textAlign: 'center' },

    summaryLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },
    pathRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    pathChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceMuted },
    pathChipTarget: { backgroundColor: colors.primary },
    pathChipText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },

    noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.primaryLight, borderRadius: 10, padding: 12, marginBottom: 14 },
    noteText: { flex: 1, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },

    fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
    renameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    renameInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.card },
    extChip: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
    extChipText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    extHint: { fontSize: 11, color: colors.textMuted, marginBottom: 12 },

    confirmRow: { flexDirection: 'row', gap: 10 },
    secondaryBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceMuted },
    secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary },
    // Standalone (non-row) primary button: must NOT flex-grow in the column,
    // otherwise flexBasis:0 collapses its content box and clips the icon/label.
    moveHereBtn: { flex: 0, alignSelf: 'stretch' },
    primaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
    btnBusy: { opacity: 0.5 },
  });

export default StorageFileActionsModal;
