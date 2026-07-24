import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
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
 * Per-file actions for a stored video: Move to another folder, or Delete.
 *
 * On open it loads the file's catalog dependencies (which groups/sessions and
 * how much watch history reference it) so the admin sees the blast radius
 * before acting. Moving keeps every mapping intact automatically — the backend
 * only repoints the blob path — so those dependencies are shown as reassurance,
 * not a blocker. Deleting reuses the app's try-hard / fall-back-to-disable
 * convention when history exists.
 *
 * `file` is the storage file object ({ name, size, videoUrl }) or null to hide.
 * `name` is the raw blob path the endpoints key on. `onChanged` fires after a
 * successful move/delete so the parent can refresh storage + catalog.
 */
const dirName = (path) => {
  const i = (path || '').lastIndexOf('/');
  return i >= 0 ? path.slice(0, i + 1) : '';
};

const StorageFileActionsModal = ({ file, onClose, onChanged }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [info, setInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [dirs, setDirs] = useState([]);
  const [dirsLoading, setDirsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const path = file?.name || '';
  const fileName = path.split('/').pop() || path;
  const currentDir = dirName(path);

  useEffect(() => {
    if (!file) {
      setInfo(null);
      setMoveMode(false);
      setDirs([]);
      return;
    }
    setInfoLoading(true);
    apiClient
      .get(ENDPOINTS.VIDEO_STORAGE_FILE_INFO, { params: { path } })
      .then((res) => setInfo(res?.data || null))
      .catch(() => setInfo(null))
      .finally(() => setInfoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const enterMoveMode = () => {
    setMoveMode(true);
    setDirsLoading(true);
    // Top-level program folders are the realistic move targets.
    apiClient
      .get(ENDPOINTS.VIDEO_STORAGE_DIRECTORIES, { params: {} })
      .then((res) => setDirs(res?.data?.directories || []))
      .catch(() => setDirs([]))
      .finally(() => setDirsLoading(false));
  };

  const doMove = (dstDir) => {
    setBusy(true);
    apiClient
      .post(ENDPOINTS.VIDEO_STORAGE_MOVE, { src_path: path, dst_directory: dstDir })
      .then((res) => {
        const groups = res?.data?.dependencies?.groups || [];
        const carried = groups.length
          ? ` It stays in ${groups.length} group${groups.length !== 1 ? 's' : ''}.`
          : '';
        onChanged?.();
        onClose?.();
        showAlert('Moved', `${res?.message || 'File moved.'}${carried}`);
      })
      .catch((err) => {
        showAlert('Move failed', err?.message || 'Could not move the file.');
      })
      .finally(() => setBusy(false));
  };

  const doDelete = () => {
    const deps = info?.dependencies;
    const usedBits = [];
    if (deps?.groups?.length) usedBits.push(`${deps.groups.length} group(s)`);
    if (deps?.sessions?.length) usedBits.push(`${deps.sessions.length} session(s)`);
    if (deps?.historyCount) usedBits.push(`${deps.historyCount} history record(s)`);
    const usedLine = usedBits.length ? `\n\nIn use by: ${usedBits.join(', ')}.` : '';

    showConfirm(
      'Delete video',
      `Permanently delete "${fileName}" and its file from storage? This cannot be undone.${usedLine}`,
      () => {
        setBusy(true);
        apiClient
          .delete(ENDPOINTS.VIDEO_STORAGE_DELETE_FILE, { params: { path, hard: true } })
          .then(() => {
            onChanged?.();
            onClose?.();
            showAlert('Deleted', `"${fileName}" was deleted.`);
          })
          .catch((err) => {
            setBusy(false);
            if (err?.message && /history/i.test(err.message)) {
              // Hard delete refused because history references it — offer the
              // safe fallback: deactivate (hides it from the apps, keeps file).
              showConfirm(
                'Cannot delete permanently',
                `${err.message}`,
                () => {
                  setBusy(true);
                  apiClient
                    .delete(ENDPOINTS.VIDEO_STORAGE_DELETE_FILE, { params: { path, hard: false } })
                    .then(() => {
                      onChanged?.();
                      onClose?.();
                      showAlert('Disabled', `"${fileName}" was disabled and hidden from the apps.`);
                    })
                    .catch((e2) => showAlert('Error', e2?.message || 'Failed to disable video.'))
                    .finally(() => setBusy(false));
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

  const deps = info?.dependencies;

  return (
    <Modal visible={!!file} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <View style={styles.header}>
            <MCIcon name="movie-outline" size={22} color={colors.primary} />
            <Text style={styles.title} numberOfLines={1}>{fileName}</Text>
            <TouchableOpacity onPress={onClose}>
              <MCIcon name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {infoLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Checking usage…</Text>
            </View>
          ) : (
            <View style={styles.depBox}>
              {deps ? (
                <>
                  <View style={styles.depRow}>
                    <MCIcon name="folder-multiple-outline" size={16} color={colors.textSecondary} />
                    <Text style={styles.depText}>
                      {deps.groups.length ? `Groups: ${deps.groups.map((g) => g.title).join(', ')}` : 'Not in any group'}
                    </Text>
                  </View>
                  {deps.sessions.length > 0 && (
                    <View style={styles.depRow}>
                      <MCIcon name="meditation" size={16} color={colors.textSecondary} />
                      <Text style={styles.depText}>Sessions: {deps.sessions.map((s) => s.title).join(', ')}</Text>
                    </View>
                  )}
                  <View style={styles.depRow}>
                    <MCIcon name="history" size={16} color={colors.textSecondary} />
                    <Text style={styles.depText}>
                      {deps.historyCount ? `${deps.historyCount} watch-history record(s)` : 'No watch history'}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.depRow}>
                  <MCIcon name="information-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.depText}>Not in the catalog yet — no group or session uses it.</Text>
                </View>
              )}
            </View>
          )}

          {moveMode ? (
            <View style={styles.moveBox}>
              <Text style={styles.moveHint}>Move to…</Text>
              {dirsLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : (
                <ScrollView style={{ maxHeight: 240 }}>
                  {currentDir !== '' && (
                    <TouchableOpacity style={styles.dirOption} disabled={busy} onPress={() => doMove('')}>
                      <MCIcon name="folder-home-outline" size={20} color={colors.primary} />
                      <Text style={styles.dirOptionText}>root</Text>
                    </TouchableOpacity>
                  )}
                  {dirs
                    .filter((d) => d !== currentDir)
                    .map((d) => (
                      <TouchableOpacity key={d} style={styles.dirOption} disabled={busy} onPress={() => doMove(d)}>
                        <MCIcon name="folder-outline" size={20} color={colors.warning} />
                        <Text style={styles.dirOptionText} numberOfLines={1}>
                          {d.replace(/\/$/, '').split('/').pop()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  {dirs.filter((d) => d !== currentDir).length === 0 && currentDir === '' && (
                    <Text style={styles.emptyDirs}>No other folders to move to.</Text>
                  )}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.secondaryBtn} disabled={busy} onPress={() => setMoveMode(false)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.moveBtn]} disabled={busy} onPress={enterMoveMode}>
                <MCIcon name="folder-move-outline" size={20} color={colors.white} />
                <Text style={styles.actionBtnText}>Move</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} disabled={busy} onPress={doDelete}>
                {busy ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <MCIcon name="delete-outline" size={20} color={colors.white} />
                )}
                <Text style={styles.actionBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
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
    depBox: { backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: 12, gap: 8, marginBottom: 14 },
    depRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    depText: { flex: 1, fontSize: 12.5, color: colors.textSecondary },
    actionsRow: { flexDirection: 'row', gap: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
    moveBtn: { backgroundColor: colors.primary },
    deleteBtn: { backgroundColor: '#EF4444' },
    actionBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
    moveBox: { gap: 6 },
    moveHint: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
    dirOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
    dirOptionText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    emptyDirs: { fontSize: 13, color: colors.textMuted, paddingVertical: 12, textAlign: 'center' },
    secondaryBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    secondaryBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  });

export default StorageFileActionsModal;
