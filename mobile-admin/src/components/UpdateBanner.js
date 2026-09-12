/**
 * "A newer version is available" banner.
 *
 * Replaces the old in-app updater. The app is distributed through the stores,
 * so it cannot (and must not) download or install a build itself — tapping the
 * banner opens the store listing and the store does the rest. Play also
 * auto-updates on Wi-Fi with no help from us; this only exists to nudge the
 * stragglers and to hard-stop a build the API no longer supports.
 *
 *  - Optional → dismissible, "Later" remembered per-version, and suppressed
 *    entirely while Settings → Auto-update is off.
 *  - Forced → no dismiss affordance, and it re-asserts itself on every
 *    foreground until the user actually updates.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import {
  checkForUpdate,
  getAutoUpdateEnabled,
  openStoreListing,
} from '../services/updateService';
import useTheme from '../hooks/useTheme';

const SKIP_KEY = 'pz_update_skipped_version';

export default function UpdateBanner() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [info, setInfo] = useState(null);

  const runCheck = useCallback(async () => {
    const u = await checkForUpdate();
    if (!u) return;
    if (!u.forced) {
      const auto = await getAutoUpdateEnabled();
      if (!auto) return;
      let skipped = null;
      try {
        skipped = await AsyncStorage.getItem(SKIP_KEY);
      } catch {}
      if (skipped === u.version) return;
    }
    setInfo(u);
  }, []);

  const isLoggedIn = useAuthStore(s => s.isLoggedIn);
  useEffect(() => {
    runCheck();
  }, [runCheck, isLoggedIn]);

  // Re-check on foreground: a forced release published mid-session should not
  // wait for the next cold start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') runCheck();
    });
    return () => sub.remove();
  }, [runCheck]);

  if (!info) return null;

  const onLater = async () => {
    try {
      await AsyncStorage.setItem(SKIP_KEY, info.version);
    } catch {}
    setInfo(null);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, info.forced && styles.cardForced]}>
        <MCIcon
          name={info.forced ? 'shield-alert-outline' : 'cellphone-arrow-down'}
          size={22}
          color={colors.primary || '#1FA77A'}
          style={styles.icon}
        />
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {info.forced ? 'Update required' : 'Update available'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Version {info.version}
            {info.current ? ` · you have ${info.current}` : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.cta}
          onPress={openStoreListing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Update to version ${info.version}`}>
          <Text style={styles.ctaText}>Update</Text>
        </TouchableOpacity>
        {!info.forced && (
          <TouchableOpacity
            style={styles.close}
            onPress={onLater}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss update notice">
            <MCIcon name="close" size={18} color={colors.textMuted || '#64748b'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = colors =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card || '#fff',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border || 'rgba(0,0,0,0.10)',
      paddingVertical: 10,
      paddingHorizontal: 12,
      shadowColor: '#0f172a',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    cardForced: { borderColor: colors.primary || '#1FA77A', borderWidth: 1 },
    icon: { marginRight: 10 },
    copy: { flex: 1, minWidth: 0 },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary || '#0f172a',
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted || '#64748b',
      marginTop: 1,
    },
    cta: {
      backgroundColor: colors.primary || '#1FA77A',
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
      marginLeft: 10,
    },
    ctaText: { color: colors.white || '#fff', fontSize: 13, fontWeight: '700' },
    close: { paddingLeft: 10, paddingVertical: 6 },
  });
