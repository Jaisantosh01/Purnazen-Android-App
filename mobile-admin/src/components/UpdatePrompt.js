/**
 * In-app update dialog with background download + direct install.
 *
 * Runs checkForUpdate() once on mount and notifies for ANY newer version:
 *  - Optional update  → dismissible dialog ("Later" is remembered per-version so
 *    the user isn't nagged every launch). Tapping "Download & install" downloads
 *    the APK in the background (progress bar; can be sent to the background where
 *    a system notification tracks it) and, when done, launches the OS installer.
 *  - Forced update (release marked `forced`) → non-dismissible; the download
 *    starts automatically in the background and installs as soon as it lands.
 *
 * The heavy lifting is the native `OtaUpdater` module (Android DownloadManager +
 * FileProvider install intent). Installing needs the OS "install unknown apps"
 * consent; if it's missing we deep-link the user to that screen and finish the
 * install when they return. When the native module is unavailable we fall back
 * to the old browser hand-off so nothing regresses.
 */
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Linking, ScrollView,
  ActivityIndicator, AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { checkForUpdate, FORCE_MARKER } from '../services/updateService';
import {
  isOtaSupported, canInstall, openInstallSettings, downloadUpdate, installUpdate,
  onOtaEvent, OTA_EVENTS,
} from '../services/otaUpdater';
import useTheme from '../hooks/useTheme';

const SKIP_KEY = 'pz_update_skipped_version';

// prompt → downloading → (ready if install blocked) → installing ; error on failure
export default function UpdatePrompt() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [info, setInfo] = useState(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('prompt');
  const [progress, setProgress] = useState(-1);
  const [errorMsg, setErrorMsg] = useState('');

  const infoRef = useRef(null);
  const fileRef = useRef(null);   // downloaded APK path (from the complete event)
  const guidedRef = useRef(false); // opened the "unknown apps" screen already?

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
      setPhase('installing');
      await installUpdate(filePath || fileRef.current);
    } catch {
      setErrorMsg('Could not open the installer');
      setPhase('error');
    }
  }, []);

  // ── Update check ───────────────────────────────────────────────────────────
  // Runs at launch (signed in or not — /app-releases/latest is public), again
  // whenever the auth state flips, and whenever the app returns to the
  // foreground. Previously this fired exactly once on mount: at the login
  // screen the call 401'd, and nothing ever re-checked afterwards, so a forced
  // release only ever surfaced through the manual "Check for Updates" button.
  const runCheck = useCallback(async () => {
    if (infoRef.current) return; // already prompted for a version this session
    const u = await checkForUpdate();
    if (!u || infoRef.current) return;
    if (!u.forced) {
      const skipped = await AsyncStorage.getItem(SKIP_KEY);
      if (skipped === u.version) return; // "Later" already chosen for this version
    }
    if (infoRef.current) return;
    infoRef.current = u;
    setInfo(u);
    setVisible(true);
    // Forced update: pull it down in the background straight away.
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

  // ── Native download lifecycle ──────────────────────────────────────────────
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
    ];
    return () => subs.forEach(s => s.remove());
  }, [native, maybeInstall]);

  // ── Retry the install when the user returns from the settings screen ───────
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

  // Optional updates can be sent to the background mid-download; the system
  // notification keeps tracking and the install notification brings them back.
  const onHide = () => setVisible(false);

  const onRetry = async () => {
    // Re-check to mint a fresh SAS URL (they expire ~15 min) before retrying.
    const u = await checkForUpdate({ force: true });
    if (u?.version) { infoRef.current = u; setInfo(u); beginDownload(u); }
    else { setErrorMsg('Still unable to fetch the update'); setPhase('error'); }
  };

  const canDismiss = !info.forced;
  const pct = progress >= 0 ? Math.min(100, Math.max(0, progress)) : null;

  const renderBody = () => {
    switch (phase) {
      case 'downloading':
        return (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct ?? 6}%` }]} />
            </View>
            <Text style={styles.statusText}>
              {pct != null ? `Downloading update… ${pct}%` : 'Starting download…'}
            </Text>
            {canDismiss && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onHide} activeOpacity={0.7}>
                <Text style={styles.secondaryText}>Continue in background</Text>
              </TouchableOpacity>
            )}
          </>
        );
      case 'ready':
        return (
          <>
            <Text style={styles.statusText}>
              Update downloaded. Allow this app to install updates to finish.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => maybeInstall(fileRef.current)} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Install now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={openInstallSettings} activeOpacity={0.7}>
              <Text style={styles.secondaryText}>Open settings</Text>
            </TouchableOpacity>
          </>
        );
      case 'installing':
        return (
          <>
            <View style={styles.spinnerRow}>
              <ActivityIndicator color={colors.primary || '#1FA77A'} />
              <Text style={[styles.statusText, { marginBottom: 0, marginLeft: 10 }]}>
                Opening installer…
              </Text>
            </View>
            <Text style={styles.hintText}>Follow the system prompt to finish updating.</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => maybeInstall(fileRef.current)} activeOpacity={0.7}>
              <Text style={styles.secondaryText}>Install again</Text>
            </TouchableOpacity>
          </>
        );
      case 'error':
        return (
          <>
            <Text style={styles.errorText}>{errorMsg || 'Something went wrong'}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onRetry} activeOpacity={0.85}>
              <Text style={styles.primaryText}>Retry</Text>
            </TouchableOpacity>
            {!!info.apkUrl && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={openInBrowser} activeOpacity={0.7}>
                <Text style={styles.secondaryText}>Open in browser</Text>
              </TouchableOpacity>
            )}
            {canDismiss && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onLater} activeOpacity={0.7}>
                <Text style={styles.secondaryText}>Later</Text>
              </TouchableOpacity>
            )}
          </>
        );
      default: // 'prompt'
        return (
          <>
            {!!notes && (
              <ScrollView style={styles.notes} contentContainerStyle={{ paddingVertical: 4 }}>
                <Text style={styles.notesText}>{notes}</Text>
              </ScrollView>
            )}
            <TouchableOpacity style={styles.primaryBtn} onPress={onPrimary} activeOpacity={0.85}>
              <Text style={styles.primaryText}>{native ? 'Download & install' : 'Update now'}</Text>
            </TouchableOpacity>
            {canDismiss && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onLater} activeOpacity={0.7}>
                <Text style={styles.secondaryText}>Later</Text>
              </TouchableOpacity>
            )}
          </>
        );
    }
  };

  // Android back button: forced updates can't be dismissed; a running download
  // can be backgrounded; otherwise it's a "Later".
  const onRequestClose = () => {
    if (!canDismiss) return;
    if (phase === 'downloading' || phase === 'installing') onHide();
    else onLater();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {info.forced ? 'Update required' : 'Update available'}
          </Text>
          <Text style={styles.subtitle}>
            Version {info.version} is available{info.current ? ` (you have ${info.current})` : ''}.
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card || '#fff',
    borderRadius: 16,
    padding: 22,
  },
  title: { fontSize: 19, fontWeight: '700', color: colors.textPrimary || '#111', marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textMuted || '#666', marginBottom: 14 },
  notes: { maxHeight: 160, marginBottom: 16 },
  notesText: { fontSize: 13, lineHeight: 19, color: colors.textPrimary || '#333' },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border || 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary || '#1FA77A' },
  statusText: { fontSize: 14, color: colors.textMuted || '#666', marginBottom: 14 },
  hintText: { fontSize: 12, color: colors.textMuted || '#888', marginBottom: 10 },
  errorText: { fontSize: 14, color: colors.danger || '#D14343', marginBottom: 14 },
  spinnerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  primaryBtn: {
    backgroundColor: colors.primary || '#1FA77A',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: { color: colors.white || '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  secondaryText: { color: colors.textMuted || '#666', fontSize: 14, fontWeight: '600' },
});
