/**
 * In-app update dialog with background download + direct install.
 *
 *  - Optional (dismissible) → "Later" remembered per-version; respects Settings
 *    auto-update (when OFF, optional updates stay quiet until manual check).
 *  - Forced (non-dismissible) → always shown; download starts immediately.
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Linking, ScrollView,
  ActivityIndicator, AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import {
  checkForUpdate, FORCE_MARKER, getAutoUpdateEnabled,
} from '../services/updateService';
import {
  isOtaSupported, canInstall, openInstallSettings, downloadUpdate, installUpdate,
  clearUpdateNotifications, onOtaEvent, OTA_EVENTS,
} from '../services/otaUpdater';
import useTheme from '../hooks/useTheme';

const SKIP_KEY = 'pz_update_skipped_version';

export default function UpdatePrompt() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [info, setInfo] = useState(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('prompt');
  const [progress, setProgress] = useState(-1);
  const [errorMsg, setErrorMsg] = useState('');
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const infoRef = useRef(null);
  const fileRef = useRef(null);
  const guidedRef = useRef(false);

  const native = isOtaSupported();

  const beginDownload = useCallback(async (u) => {
    const data = u || infoRef.current;
    if (!data?.apkUrl) { setErrorMsg('Download link unavailable'); setPhase('error'); return; }
    try {
      setErrorMsg('');
      setProgress(-1);
      setPhase('downloading');
      await downloadUpdate(data.apkUrl, data.version, data.sha256);
    } catch {
      setErrorMsg('Could not start the download');
      setPhase('error');
    }
  }, []);

  const maybeInstall = useCallback(async (filePath) => {
    const allowed = await canInstall();
    if (!allowed) {
      setPhase('ready');
      if (!guidedRef.current) { guidedRef.current = true; openInstallSettings(); }
      return;
    }
    try {
      setAwaitingConfirm(false);
      setPhase('installing');
      await installUpdate(filePath || fileRef.current);
    } catch {
      setErrorMsg('Could not open the installer');
      setPhase('error');
    }
  }, []);

  // Auto check: skip optional when auto-update is off; forced always surfaces.
  const runCheck = useCallback(async () => {
    if (infoRef.current) return;
    const u = await checkForUpdate();
    if (!u || infoRef.current) return;
    if (!u.forced) {
      const auto = await getAutoUpdateEnabled();
      if (!auto) return;
      const skipped = await AsyncStorage.getItem(SKIP_KEY);
      if (skipped === u.version) return;
    }
    if (infoRef.current) return;
    infoRef.current = u;
    setInfo(u);
    setVisible(true);
    if (u.forced && native && u.apkUrl) beginDownload(u);
  }, [native, beginDownload]);

  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  useEffect(() => { runCheck(); }, [runCheck, isLoggedIn]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') runCheck();
    });
    return () => sub.remove();
  }, [runCheck]);

  useEffect(() => {
    if (!native) return undefined;
    const subs = [
      onOtaEvent(OTA_EVENTS.PROGRESS, (e) => {
        setProgress(typeof e?.progress === 'number' ? e.progress : -1);
      }),
      onOtaEvent(OTA_EVENTS.COMPLETE, (e) => {
        fileRef.current = e?.filePath || null;
        setProgress(100);
        maybeInstall(e?.filePath || null);
      }),
      onOtaEvent(OTA_EVENTS.ERROR, (e) => {
        setErrorMsg(e?.message || 'Download failed');
        setPhase('error');
      }),
      onOtaEvent(OTA_EVENTS.INSTALL, (e) => {
        if (e?.status === 'pending_user_action') { setAwaitingConfirm(true); return; }
        if (e?.status === 'error') {
          setErrorMsg(e?.message || 'Install failed');
          setPhase('error');
        }
      }),
    ];
    return () => subs.forEach(s => s.remove());
  }, [native, maybeInstall]);

  useEffect(() => { clearUpdateNotifications(); }, []);

  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') maybeInstall(fileRef.current);
    });
    return () => sub.remove();
  }, [phase, maybeInstall]);

  if (!info) return null;

  const notes = (info.notes || '')
    .split('\n')
    .filter(l => !l.includes(FORCE_MARKER))
    .join('\n')
    .trim();

  const openInBrowser = () => { if (info.apkUrl) Linking.openURL(info.apkUrl).catch(() => {}); };

  const onPrimary = () => {
    if (!native || !info.apkUrl) { openInBrowser(); return; }
    beginDownload(info);
  };

  const onLater = async () => {
    try { await AsyncStorage.setItem(SKIP_KEY, info.version); } catch {}
    setVisible(false);
  };

  const onHide = () => setVisible(false);

  const onRetry = async () => {
    const u = await checkForUpdate({ force: true });
    if (u?.version) { infoRef.current = u; setInfo(u); beginDownload(u); }
    else { setErrorMsg('Still unable to fetch the update'); setPhase('error'); }
  };

  const canDismiss = !info.forced;
  const pct = progress >= 0 ? Math.min(100, Math.max(0, progress)) : null;
  const accent = colors.primary || '#1FA77A';

  const renderBody = () => {
    switch (phase) {
      case 'downloading':
        return (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct ?? 8}%` }]} />
            </View>
            <Text style={styles.statusText}>
              {pct != null ? `${pct}%` : 'Starting…'}
            </Text>
            {canDismiss && (
              <TouchableOpacity style={styles.ghostBtn} onPress={onHide} activeOpacity={0.7}>
                <Text style={styles.ghostText}>Continue in background</Text>
              </TouchableOpacity>
            )}
          </>
        );
      case 'ready':
        return (
          <>
            <Text style={styles.statusText}>
              Allow installs from this app to finish updating.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => maybeInstall(fileRef.current)} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Install now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={openInstallSettings} activeOpacity={0.7}>
              <Text style={styles.ghostText}>Open settings</Text>
            </TouchableOpacity>
          </>
        );
      case 'installing':
        return (
          <>
            <View style={styles.spinnerRow}>
              <ActivityIndicator color={accent} />
              <Text style={styles.statusInline}>
                {awaitingConfirm ? 'Confirm install…' : 'Installing…'}
              </Text>
            </View>
            <Text style={styles.hintText}>
              {awaitingConfirm
                ? 'Follow the system prompt to finish.'
                : 'The app will restart when done.'}
            </Text>
          </>
        );
      case 'error':
        return (
          <>
            <Text style={styles.errorText}>{errorMsg || 'Something went wrong'}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onRetry} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Try again</Text>
            </TouchableOpacity>
            {!!info.apkUrl && (
              <TouchableOpacity style={styles.ghostBtn} onPress={openInBrowser} activeOpacity={0.7}>
                <Text style={styles.ghostText}>Open in browser</Text>
              </TouchableOpacity>
            )}
            {canDismiss && (
              <TouchableOpacity style={styles.ghostBtn} onPress={onLater} activeOpacity={0.7}>
                <Text style={styles.ghostText}>Not now</Text>
              </TouchableOpacity>
            )}
          </>
        );
      default:
        return (
          <>
            {!!notes && (
              <ScrollView style={styles.notes} contentContainerStyle={{ paddingVertical: 2 }}>
                <Text style={styles.notesText}>{notes}</Text>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.primaryBtn} onPress={onPrimary} activeOpacity={0.85}>
              <Text style={styles.primaryText}>{native ? 'Update' : 'Update now'}</Text>
            </TouchableOpacity>
            {canDismiss && (
              <TouchableOpacity style={styles.ghostBtn} onPress={onLater} activeOpacity={0.7}>
                <Text style={styles.ghostText}>Not now</Text>
              </TouchableOpacity>
            )}
          </>
        );
    }
  };

  const onRequestClose = () => {
    if (!canDismiss) return;
    if (phase === 'downloading' || phase === 'installing') onHide();
    else onLater();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: `${accent}18` }]}>
            <MCIcon
              name={info.forced ? 'shield-alert-outline' : 'cellphone-arrow-down'}
              size={28}
              color={accent}
            />
          </View>
          <Text style={styles.title}>
            {info.forced ? 'Update required' : 'Update available'}
          </Text>
          <Text style={styles.subtitle}>
            Version {info.version}
            {info.current ? ` · you have ${info.current}` : ''}
          </Text>
          {renderBody()}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = colors => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card || '#fff',
    borderRadius: 24,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary || '#0f172a',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted || '#64748b',
    marginBottom: 18,
    textAlign: 'center',
  },
  notes: { maxHeight: 120, width: '100%', marginBottom: 14 },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary || colors.textPrimary || '#334155',
    textAlign: 'center',
  },
  track: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border || 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary || '#1FA77A' },
  statusText: {
    fontSize: 13,
    color: colors.textMuted || '#64748b',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusInline: {
    fontSize: 14,
    color: colors.textMuted || '#64748b',
    marginLeft: 10,
  },
  hintText: {
    fontSize: 12,
    color: colors.textMuted || '#94a3b8',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: colors.danger || '#D14343',
    marginBottom: 14,
    textAlign: 'center',
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.primary || '#1FA77A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.white || '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  ghostText: { color: colors.textMuted || '#64748b', fontSize: 14, fontWeight: '600' },
});
