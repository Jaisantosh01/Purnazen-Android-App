import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, Linking,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import mfaService, { groupSecret } from '../services/mfaService';
import { useAuthStore } from '../store/authStore';
import { showAlert } from '../utils/alert';
import useTheme from '../hooks/useTheme';
import AppToggle from './AppToggle';

/**
 * Settings rows for two-step verification (authenticator app). Renders the
 * on/off toggle plus a "new recovery codes" row while it is on, and owns the
 * one modal every step uses: enrol (secret + first code), disable (code),
 * regenerate (code). Recovery codes are shown once, in an alert.
 */
const TwoStepVerification = ({ rowStyle, iconBoxStyle, titleStyle, subtitleStyle, dividerStyle }) => {
  const user = useAuthStore(s => s.user ?? s.doctor); // the doctor app keys the profile as `doctor`
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const enabled = !!user?.mfa_enabled;

  const [mode, setMode] = useState(null); // 'enable' | 'disable' | 'codes' | null
  const [setup, setSetup] = useState(null); // { secret, otpauth_uri, account }
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => { setMode(null); setSetup(null); setCode(''); setError(''); };

  const showCodes = (codes, title) => showAlert(
    title,
    'Each code signs you in once if you lose your authenticator. Save them somewhere safe — they are not shown again.\n\n' +
      (codes || []).join('\n'),
  );

  const start = async next => {
    setError('');
    if (next) {
      setBusy(true);
      try {
        setSetup(await mfaService.setup());
        setMode('enable');
      } catch (err) {
        showAlert('Two-step verification', err.message || 'Could not start setup.');
      } finally {
        setBusy(false);
      }
    } else {
      setMode('disable');
    }
  };

  const submit = async () => {
    if (!code.trim()) { setError('Enter the 6-digit code.'); return; }
    setBusy(true);
    setError('');
    try {
      if (mode === 'enable') {
        const data = await mfaService.enable(code);
        await authService.applyProfile(data.user);
        close();
        showCodes(data.recovery_codes, 'Two-step verification is on');
      } else if (mode === 'disable') {
        const data = await mfaService.disable(code);
        await authService.applyProfile(data.user);
        close();
      } else {
        const data = await mfaService.newRecoveryCodes(code);
        close();
        showCodes(data.recovery_codes, 'New recovery codes');
      }
    } catch (err) {
      setError(err.message || 'That code did not work.');
    } finally {
      setBusy(false);
    }
  };

  const titles = { enable: 'Set up authenticator', disable: 'Turn off two-step verification', codes: 'New recovery codes' };

  return (
    <>
      <View style={rowStyle}>
        <View style={[iconBoxStyle, { backgroundColor: `${colors.primary}22` }]}>
          <MCIcon name="shield-key-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={titleStyle}>Two-step verification</Text>
          <Text style={subtitleStyle}>{enabled ? 'On — authenticator app' : user?.mfa_required ? 'Required for your role' : 'Codes from an authenticator app'}</Text>
        </View>
        <AppToggle value={enabled} onValueChange={start} disabled={busy} />
      </View>
      {enabled ? (
        <>
          <View style={dividerStyle} />
          <TouchableOpacity style={rowStyle} onPress={() => setMode('codes')} activeOpacity={0.7}>
            <View style={[iconBoxStyle, styles.amberBox]}>
              <MCIcon name="key-variant" size={20} color="#F59E0B" />
            </View>
            <View style={styles.info}>
              <Text style={titleStyle}>Recovery codes</Text>
              <Text style={subtitleStyle}>Replace the codes with a new set</Text>
            </View>
            <MCIcon name="chevron-right" size={20} color={colors.borderStrong} />
          </TouchableOpacity>
        </>
      ) : null}

      <Modal visible={!!mode} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{titles[mode] || ''}</Text>
            {mode === 'enable' && setup ? (
              <>
                <Text style={styles.help}>Add this account to Google Authenticator, Authy or any authenticator app, then enter the code it shows.</Text>
                <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(setup.otpauth_uri).catch(() => {})}>
                  <MCIcon name="open-in-app" size={16} color={colors.primary} />
                  <Text style={styles.openText}>Open in authenticator app</Text>
                </TouchableOpacity>
                <Text style={styles.label}>Or enter this key manually</Text>
                <Text style={styles.secret} selectable>{groupSecret(setup.secret)}</Text>
              </>
            ) : null}
            {mode === 'disable' ? <Text style={styles.help}>Your account will sign in with just a password. Confirm with a code from your authenticator app.</Text> : null}
            {mode === 'codes' ? <Text style={styles.help}>Your old recovery codes stop working. Confirm with a code from your authenticator app.</Text> : null}
            <Text style={styles.label}>Authenticator code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={t => { setCode(t); setError(''); }}
              placeholder="123 456"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
              editable={!busy}
              onSubmitEditing={submit}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={close} disabled={busy}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={submit} disabled={busy}>
                {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.btnSaveText}>{mode === 'enable' ? 'Turn on' : 'Confirm'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = colors => StyleSheet.create({
  info: { flex: 1 },
  amberBox: { backgroundColor: '#F59E0B22' },
  overlay: { flex: 1, backgroundColor: colors.overlay || 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: colors.modalSurface || colors.card, borderRadius: 18, padding: 20,
    borderWidth: 1, borderColor: colors.modalBorder || colors.border, elevation: 12,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  help: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  openText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 14 },
  secret: {
    fontSize: 15, letterSpacing: 1, fontFamily: 'monospace', color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted, borderRadius: 10, padding: 12,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 18, letterSpacing: 3, color: colors.textPrimary, backgroundColor: colors.surfaceMuted,
  },
  error: { fontSize: 12, color: colors.danger, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  btnCancel: { backgroundColor: colors.surfaceMuted },
  btnSave: { backgroundColor: colors.primary, minWidth: 90, alignItems: 'center' },
  btnCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  btnSaveText: { fontSize: 14, fontWeight: '600', color: colors.white },
});

export default TwoStepVerification;
