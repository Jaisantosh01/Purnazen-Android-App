import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import { showAlert } from '../utils/alert';
import useTheme from '../hooks/useTheme';

/**
 * Second step of sign-in. Shown by App.tsx while mfaStore holds a challenge
 * token (password/social step passed, code still owed). The one input accepts
 * a 6-digit authenticator code or a recovery code; the backend tells them apart.
 */
const TwoStepScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) { setError('Enter the code from your authenticator app.'); return; }
    setError('');
    setBusy(true);
    try {
      const { recoveryCodesLeft } = await authService.completeTwoStep(code);
      // Auth-state flip swaps the root navigator to Main; warn if codes run low.
      if (typeof recoveryCodesLeft === 'number' && recoveryCodesLeft <= 2) {
        showAlert('Recovery codes running low',
          `You have ${recoveryCodesLeft} recovery code${recoveryCodesLeft === 1 ? '' : 's'} left. Create new ones in Settings.`);
      }
    } catch (err) {
      setError(err.message || 'That code did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <View style={styles.card}>
        <View style={styles.iconBox}><MCIcon name="shield-key-outline" size={30} color={colors.primary} /></View>
        <Text style={styles.title}>Two-step verification</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={t => { setCode(t); setError(''); }}
          placeholder="123 456"
          placeholderTextColor={colors.textMuted}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'visible-password'}
          returnKeyType="done"
          onSubmitEditing={submit}
          editable={!busy}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={submit} disabled={busy} activeOpacity={0.8}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => authService.cancelTwoStep()} disabled={busy} style={styles.cancel}>
          <Text style={styles.cancelText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 24, alignItems: 'center' },
  iconBox: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${colors.primary}22`, marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  input: {
    alignSelf: 'stretch', borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, letterSpacing: 4, textAlign: 'center',
    color: colors.textPrimary, backgroundColor: colors.surfaceMuted,
  },
  error: { fontSize: 12, color: colors.danger, marginTop: 10, alignSelf: 'flex-start' },
  button: {
    alignSelf: 'stretch', backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 18,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  cancel: { marginTop: 14, padding: 6 },
  cancelText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});

export default TwoStepScreen;
