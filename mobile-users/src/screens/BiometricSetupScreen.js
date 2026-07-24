import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { useProfileStore } from '../store/profileStore';
import biometricService from '../services/biometricService';
import { showSuccess } from '../utils/toast';

/**
 * One-time post-sign-up step that offers to turn on biometric unlock.
 *
 * Reached only when the device supports biometrics (the sign-up flow gates the
 * `pendingBiometricSetup` flag on availability), but it also self-skips
 * defensively if biometrics are unavailable or already enabled. "Enable" mirrors
 * Settings → Biometric Login (biometricService.enable()); "Skip for now" just
 * clears the gate. Either way the app continues to the main tabs.
 */
const isFace = t => !!t && /face/i.test(t);

const BiometricSetupScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const setPendingBiometricSetup = useProfileStore(s => s.setPendingBiometricSetup);

  const [type, setType] = useState(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = () => setPendingBiometricSetup(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await biometricService.isEnabled()) { finish(); return; }
        const t = await biometricService.getSupportedType();
        if (cancelled) return;
        if (!t) { finish(); return; } // no enrolled biometrics — skip silently
        setType(t);
      } catch {
        finish();
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = isFace(type) ? 'Face Unlock' : 'Fingerprint Unlock';
  const noun = isFace(type) ? 'face' : 'fingerprint';
  const icon = isFace(type) ? 'face-recognition' : 'fingerprint';

  const handleEnable = async () => {
    setError('');
    setBusy(true);
    try {
      const t = await biometricService.enable();
      showSuccess(`${isFace(t) ? 'Face' : 'Fingerprint'} unlock enabled`);
      finish();
    } catch (err) {
      setError(err.message || 'Could not enable biometric unlock.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.root, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MCIcon name={icon} size={34} color={colors.white} />
        </View>
        <Text style={styles.heroTitle}>Enable {label}</Text>
        <Text style={styles.heroSub}>
          Sign in faster and keep your wellness data private — unlock Purnazen with your {noun} instead of typing your password.
        </Text>
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.pointRow}>
          <MCIcon name="flash-outline" size={20} color={colors.primary} />
          <Text style={styles.pointText}>Quicker sign-in every time you open the app</Text>
        </View>
        <View style={styles.pointRow}>
          <MCIcon name="shield-check-outline" size={20} color={colors.primary} />
          <Text style={styles.pointText}>Your {noun} stays on this device and never leaves it</Text>
        </View>
        <View style={styles.pointRow}>
          <MCIcon name="cog-outline" size={20} color={colors.primary} />
          <Text style={styles.pointText}>You can turn this off anytime in Settings</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.enableBtn, busy && styles.enableBtnDisabled]}
          onPress={handleEnable}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <MCIcon name={icon} size={20} color={colors.white} />
              <Text style={styles.enableText}>Enable {label}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={finish}
          disabled={busy}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BiometricSetupScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },

  hero: {
    backgroundColor: colors.headerBg,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: colors.white, marginBottom: 6 },
  heroSub: { fontSize: 13.5, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  body: { flex: 1, padding: 24, paddingBottom: 40 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  pointText: { flex: 1, fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  error: { fontSize: 13, color: colors.danger, marginTop: 8 },
  spacer: { flex: 1, minHeight: 20 },

  enableBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 54,
  },
  enableBtnDisabled: { opacity: 0.7 },
  enableText: { fontSize: 16, fontWeight: '800', color: colors.white },
  skipBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  skipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
