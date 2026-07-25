import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import { showAlert, showConfirm } from '../utils/alert';

/**
 * Per-folder actions for the storage browser: Rename or Delete a whole folder.
 *
 * On open it rolls up everything under the folder (file count, the groups and
 * sessions its videos belong to, and total user history) so both actions can
 * spell out the impact first:
 *   - Rename re-prefixes every blob and repoints each video_url; group/session
 *     mappings key on the video id, so they carry over untouched.
 *   - Delete removes the folder and its files + catalog records, and is refused
 *     by the backend (409) when any contained video has user history.
 *
 * `folder` is the folder prefix (e.g. "Yoga/Morning/") or null to hide.
 * `onChanged` fires after a successful action so the parent can refresh.
 */
const leafOf = (prefix) => (prefix || '').replace(/\/$/, '').split('/').pop() || (prefix || '');

const StorageFolderActionsModal = ({ folder, onClose, onChanged }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [info, setInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [view, setView] = useState('menu'); // 'menu' | 'rename'
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [renameValue, setRenameValue] = useState('');

  const folderName = leafOf(folder);

  useEffect(() => {
    if (!folder) {
      setInfo(null);
      setView('menu');
      setBusy(false);
      return;
    }
    setRenameValue(folderName);
    setInfoLoading(true);
    apiClient
      .get(ENDPOINTS.VIDEO_STORAGE_FOLDER_INFO, { params: { path: folder } })
      .then((res) => setInfo(res?.data?.dependencies || null))
      .catch(() => setInfo(null))
      .finally(() => setInfoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  const usedIn = [
    ...(info?.groups || []).map((g) => g.title),
    ...(info?.sessions || []).map((s) => s.title),
  ];
  const fileCount = info?.fileCount || 0;
  const historyCount = info?.historyCount || 0;

  const afterChange = (message) => {
    onChanged?.();
    onClose?.();
    showAlert('Done', message);
  };

  const doRename = () => {
    setBusy(true);
    setBusyLabel('Renaming…');
    apiClient
      .post(ENDPOINTS.VIDEO_STORAGE_FOLDER_RENAME, { src_path: folder, new_name: renameValue.trim() })
      .then((res) => {
        const n = res?.data?.updatedVideos || 0;
        afterChange(n ? `Folder renamed. ${n} video(s) updated everywhere they appear.` : 'Folder renamed.');
      })
      .catch((err) => {
        setBusy(false);
        showAlert('Rename failed', err?.message || 'Could not rename the folder.');
      });
  };

  const doDelete = () => {
    const impact = [
      fileCount ? `${fileCount} file(s)` : null,
      usedIn.length ? `used by ${usedIn.join(', ')}` : null,
    ].filter(Boolean).join(', ');
    const line = impact ? `\n\nThis folder has ${impact}.` : '';
    const histLine = historyCount
      ? '\n\nSome videos here have user history and can’t be permanently deleted — you’ll be asked to disable those individually.'
      : '';
    showConfirm(
      'Delete folder',
      `Permanently delete "${folderName}" and everything inside it? This cannot be undone.${line}${histLine}`,
      () => {
        setBusy(true);
        setBusyLabel('Deleting…');
        apiClient
          .delete(ENDPOINTS.VIDEO_STORAGE_FOLDER_DELETE, { params: { path: folder } })
          .then(() => afterChange(`"${folderName}" was deleted.`))
          .catch((err) => {
            setBusy(false);
            showAlert('Delete failed', err?.message || 'Could not delete the folder.');
          });
      },
      { confirmLabel: 'Delete', destructive: true },
    );
  };

  const renderHeader = (title, onBack) => (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MCIcon name="arrow-left" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : (
        <MCIcon name="folder-outline" size={22} color={colors.warning} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MCIcon name="close" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  const nameChanged = renameValue.trim() && renameValue.trim() !== folderName;

  return (
    <Modal visible={!!folder} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { if (!busy) onClose?.(); }}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {/* ── MENU ── */}
          {view === 'menu' && (
            <>
              {renderHeader(folderName)}
              {infoLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.loadingText}>Checking what’s inside…</Text>
                </View>
              ) : (
                <View style={styles.depBox}>
                  <View style={styles.depRow}>
                    <MCIcon name="movie-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.depText}>
                      {fileCount ? `${fileCount} file(s) inside` : 'Empty folder'}
                    </Text>
                  </View>
                  <View style={styles.depRow}>
                    <MCIcon name="folder-multiple-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.depText}>
                      {usedIn.length ? `Used by: ${usedIn.join(', ')}` : 'Not used by any group or session'}
                    </Text>
                  </View>
                  {historyCount > 0 && (
                    <View style={styles.depRow}>
                      <MCIcon name="history" size={16} color={colors.warning} />
                      <Text style={[styles.depText, { color: colors.warning }]}>
                        {historyCount} user-history record(s) — delete is limited
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.menuRow}>
                <TouchableOpacity style={styles.menuBtn} disabled={busy} onPress={() => setView('rename')}>
                  <MCIcon name="folder-edit-outline" size={22} color={colors.primary} />
                  <Text style={styles.menuBtnText}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuBtn} disabled={busy} onPress={doDelete}>
                  <MCIcon name="folder-remove-outline" size={22} color="#EF4444" />
                  <Text style={[styles.menuBtnText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── RENAME ── */}
          {view === 'rename' && (
            <>
              {renderHeader('Rename folder', () => setView('menu'))}
              <Text style={styles.fieldLabel}>New folder name</Text>
              <TextInput
                style={styles.renameInput}
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Folder name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoFocus
              />
              <View style={styles.noteBox}>
                <MCIcon name="information-outline" size={16} color={colors.primary} />
                <Text style={styles.noteText}>
                  {usedIn.length
                    ? `Mappings are kept — the ${fileCount} video(s) stay in ${usedIn.join(', ')}.`
                    : 'Renaming keeps every video’s group and session mappings intact.'}
                  {' The new name shows everywhere the videos appear.'}
                </Text>
              </View>
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.secondaryBtn} disabled={busy} onPress={() => setView('menu')}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, (busy || !nameChanged) && styles.btnBusy]}
                  disabled={busy || !nameChanged}
                  onPress={doRename}
                >
                  {busy ? <ActivityIndicator size="small" color={colors.white} /> : <MCIcon name="check" size={18} color={colors.white} />}
                  <Text style={styles.primaryBtnText}>Rename</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* In-flight action — blocks the card and shows what's happening so the
              menu never just sits there silently until the result lands. */}
          {busy && (
            <View style={styles.busyOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              {!!busyLabel && <Text style={styles.busyOverlayText}>{busyLabel}</Text>}
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: { backgroundColor: colors.modalSurface, borderRadius: 16, padding: 16, width: '100%', maxWidth: 420, borderWidth: 1, borderColor: colors.modalBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    title: { flex: 1, fontSize: 15, fontWeight: '800', color: colors.textPrimary },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    loadingText: { fontSize: 13, color: colors.textMuted },

    depBox: { backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: 12, gap: 8, marginBottom: 14 },
    depRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    depText: { flex: 1, fontSize: 12.5, color: colors.textSecondary },

    menuRow: { flexDirection: 'row', gap: 10 },
    menuBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surfaceMuted },
    menuBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

    fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
    renameInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, backgroundColor: colors.card, marginBottom: 10 },

    noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: colors.primaryLight, borderRadius: 10, padding: 12, marginBottom: 14 },
    noteText: { flex: 1, fontSize: 12.5, color: colors.textSecondary, lineHeight: 18 },

    confirmRow: { flexDirection: 'row', gap: 10 },
    secondaryBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.surfaceMuted },
    secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
    primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary },
    primaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
    btnBusy: { opacity: 0.5 },
    busyOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.card,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    busyOverlayText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  });

export default StorageFolderActionsModal;
