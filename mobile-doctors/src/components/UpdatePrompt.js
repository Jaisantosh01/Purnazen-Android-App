/**
 * In-app update dialog (modern "Update available" prompt).
 *
 * Runs checkForUpdate() once on mount. For an optional update it shows a
 * dismissible dialog and remembers a "Later" choice per-version so the user
 * isn't nagged every launch. For a forced update (release notes contain
 * `purnazen:force-update`) the dialog is non-dismissible — no "Later", and the
 * Android back button won't close it.
 *
 * "Update now" opens the APK's GitHub download URL with the system browser /
 * download manager, which hands off to Android's package installer. This keeps
 * the app itself free of the sensitive REQUEST_INSTALL_PACKAGES permission — the
 * OS installer handles the install-time consent.
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Linking, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkForUpdate, FORCE_MARKER } from '../services/updateService';
import useTheme from '../hooks/useTheme';

const SKIP_KEY = 'pz_update_skipped_version';

export default function UpdatePrompt() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [info, setInfo] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await checkForUpdate();
      if (!u || cancelled) return;
      if (!u.forced) {
        const skipped = await AsyncStorage.getItem(SKIP_KEY);
        if (skipped === u.version) return; // "Later" already chosen for this version
      }
      if (!cancelled) {
        setInfo(u);
        setVisible(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!info) return null;

  const onUpdate = () => { Linking.openURL(info.apkUrl).catch(() => {}); };
  const onLater = async () => {
    try { await AsyncStorage.setItem(SKIP_KEY, info.version); } catch {}
    setVisible(false);
  };

  // Hide the machine-readable force marker line from the shown notes.
  const notes = (info.notes || '')
    .split('\n')
    .filter(l => !l.includes(FORCE_MARKER))
    .join('\n')
    .trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => { if (!info.forced) onLater(); }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {info.forced ? 'Update required' : 'Update available'}
          </Text>
          <Text style={styles.subtitle}>
            Version {info.version} is available{info.current ? ` (you have ${info.current})` : ''}.
          </Text>
          {!!notes && (
            <ScrollView style={styles.notes} contentContainerStyle={{ paddingVertical: 4 }}>
              <Text style={styles.notesText}>{notes}</Text>
            </ScrollView>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={onUpdate} activeOpacity={0.85}>
            <Text style={styles.primaryText}>Update now</Text>
          </TouchableOpacity>
          {!info.forced && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onLater} activeOpacity={0.7}>
              <Text style={styles.secondaryText}>Later</Text>
            </TouchableOpacity>
          )}
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
  primaryBtn: {
    backgroundColor: colors.primary || '#1FA77A',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  secondaryText: { color: colors.textMuted || '#666', fontSize: 14, fontWeight: '600' },
});
