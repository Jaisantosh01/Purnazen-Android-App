import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Platform,
  Animated,
  Keyboard,
  ActivityIndicator,
  Pressable,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import authService from '../services/authService';
import socialAuthService from '../services/socialAuthService';
import biometricService from '../services/biometricService';
import useTheme from '../hooks/useTheme';
import { useProfileStore } from '../store/profileStore';
import { STRINGS } from '../constants/strings';
import { quickEmailIssue } from '../utils/validators';

const RegisterScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [emailHint, setEmailHint]       = useState('');
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [socialLoading, setSocialLoading] = useState(null); // 'google' | 'github'
  const [focused, setFocused]           = useState(null); // 'name' | 'email' | 'password' | 'confirm'

  const nameRef     = useRef(null);
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef  = useRef(null);

  // Keyboard-aware layout — mirrors LoginScreen. The Android window does not
  // reliably resize on its own (RN edge-to-edge), so we lift the bottom-anchored
  // card by the keyboard height ourselves. `pad` animates layout (non-native),
  // `kb` collapses the hero (native). 0 = keyboard hidden, 1 = visible.
  const pad = useRef(new Animated.Value(0)).current;
  const kb = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = e => {
      const height = e?.endCoordinates?.height ?? 0;
      Animated.parallel([
        Animated.timing(pad, { toValue: height, duration: 260, useNativeDriver: false }),
        Animated.timing(kb, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    };
    const onHide = () => {
      Animated.parallel([
        Animated.timing(pad, { toValue: 0, duration: 220, useNativeDriver: false }),
        Animated.timing(kb, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    };
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => { s.remove(); h.remove(); };
  }, [pad, kb]);

  const handleRegister = async () => {
    if (!fullName.trim())             { setError('Please enter your name.');                 return; }
    const emailIssue = quickEmailIssue(email);
    if (emailIssue)                   { setError(emailIssue); setEmailHint(emailIssue);      return; }
    if (password.length < 6)          { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)         { setError('Passwords do not match.');                 return; }
    setError('');
    setIsLoading(true);
    try {
      // Queue the one-time post-sign-up onboarding: complete-profile, then (only
      // when the device supports it) the biometric-unlock offer. Resolve
      // availability BEFORE the auth flip so both steps are set atomically.
      const bioAvailable = await biometricService.isAvailable().catch(() => false);
      useProfileStore.getState().setPendingCompletion(true);
      useProfileStore.getState().setPendingBiometricSetup(bioAvailable);
      await authService.register(fullName.trim(), email.trim(), password);
      // Navigation handled by App.tsx auth-state listener
    } catch (err) {
      useProfileStore.getState().setPendingCompletion(false);
      useProfileStore.getState().setPendingBiometricSetup(false);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Social signup IS social login: first sign-in auto-creates the account.
  const handleSocialSignup = async provider => {
    if (isLoading || socialLoading) return;
    setError('');
    setSocialLoading(provider);
    try {
      const user = await (provider === 'google'
        ? socialAuthService.signInWithGoogle()
        : socialAuthService.signInWithGitHub());
      // null = user cancelled; otherwise navigation is handled by App.tsx.
      // Only prompt profile completion when the profile is actually blank —
      // the same button may have signed into an established account.
      if (user && !user.phone && !user.gender && !user.date_of_birth) {
        const bioAvailable = await biometricService.isAvailable().catch(() => false);
        useProfileStore.getState().setPendingCompletion(true);
        useProfileStore.getState().setPendingBiometricSetup(bioAvailable);
      }
    } catch (err) {
      setError(err.message || 'Sign-up failed. Please try again.');
    } finally {
      setSocialLoading(null);
    }
  };

  const heroAnimStyle = {
    opacity: kb.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0] }),
    transform: [
      { scale: kb.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) },
      { translateY: kb.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
    ],
  };

  // Inline confirm-password affordance: show a check when the two match, an
  // alert when they differ — only once the user has started confirming.
  const confirmMatch = confirm.length > 0 && password === confirm;
  const confirmMismatch = confirm.length > 0 && password !== confirm;

  return (
    <Animated.View style={[styles.root, { paddingBottom: pad }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Hero (collapses under the keyboard) ─────────────────────────── */}
      <View style={styles.heroWrap}>
        <Animated.View style={[styles.hero, heroAnimStyle]}>
          <View style={styles.blobOne} />
          <View style={styles.blobTwo} />
          <View style={styles.logoBadge}>
            <MCIcon name="leaf" size={36} color={colors.white} />
          </View>
          <Text style={styles.appName}>Purnazen</Text>
          <Text style={styles.tagline}>AI Assisted Acupressure & Wellness</Text>
          <Text style={styles.brandTagline}>{STRINGS.BRAND_TAGLINE}</Text>
        </Animated.View>
      </View>

      {/* ── Form card (anchored to the bottom, rides above the keyboard) ── */}
      <View style={styles.card}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.cardContent, { paddingBottom: 20 + insets.bottom }]}
          bounces={false}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Sign up to begin your wellness journey</Text>

          {error.length > 0 && (
            <View style={styles.errorBox}>
              <MCIcon name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Full name */}
          <Text style={styles.label}>Full Name</Text>
          <Pressable
            onPress={() => nameRef.current?.focus()}
            style={[styles.inputContainer, focused === 'name' && styles.inputFocused]}
          >
            <MCIcon name="account-outline" size={20} color={focused === 'name' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={nameRef}
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textMuted}
              value={fullName}
              onChangeText={text => { setFullName(text); setError(''); }}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
            />
          </Pressable>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <Pressable
            onPress={() => emailRef.current?.focus()}
            style={[
              styles.inputContainer,
              focused === 'email' && styles.inputFocused,
              !!emailHint && styles.inputError,
            ]}
          >
            <MCIcon name="email-outline" size={20} color={focused === 'email' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={text => { setEmail(text); setError(''); setEmailHint(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              onFocus={() => setFocused('email')}
              onBlur={() => { setFocused(null); setEmailHint(quickEmailIssue(email) || ''); }}
            />
          </Pressable>
          {!!emailHint && (
            <View style={styles.emailHintRow}>
              <MCIcon name="information-outline" size={14} color={colors.warning} />
              <Text style={styles.emailHintText}>{emailHint}</Text>
            </View>
          )}

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <Pressable
            onPress={() => passwordRef.current?.focus()}
            style={[styles.inputContainer, focused === 'password' && styles.inputFocused]}
          >
            <MCIcon name="lock-outline" size={20} color={focused === 'password' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={text => { setPassword(text); setError(''); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(prev => !prev)}
              style={styles.eyeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MCIcon
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </Pressable>

          {/* Confirm password */}
          <Text style={styles.label}>Confirm Password</Text>
          <Pressable
            onPress={() => confirmRef.current?.focus()}
            style={[
              styles.inputContainer,
              focused === 'confirm' && styles.inputFocused,
              confirmMismatch && styles.inputError,
            ]}
          >
            <MCIcon name="lock-check-outline" size={20} color={focused === 'confirm' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={confirmRef}
              style={styles.input}
              placeholder="Repeat your password"
              placeholderTextColor={colors.textMuted}
              value={confirm}
              onChangeText={text => { setConfirm(text); setError(''); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
            />
            {confirmMatch && <MCIcon name="check-circle" size={20} color={colors.primary} />}
            {confirmMismatch && <MCIcon name="close-circle" size={20} color={colors.danger} />}
          </Pressable>

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Sign Up</Text>
                <MCIcon name="arrow-right" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or sign up with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              activeOpacity={0.8}
              onPress={() => handleSocialSignup('google')}
              disabled={isLoading || !!socialLoading}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <MCIcon name="google" size={20} color="#DB4437" />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchHint}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
              <Text style={styles.switchLink}>Login</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.poweredBy}>
            <Text style={styles.poweredByText}>Powered by </Text>
            <Text style={styles.poweredByBrand}>Calypsion</Text>
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
};

export default RegisterScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },

  // flex:1 + minHeight:0 lets the hero shrink first when the keyboard opens,
  // pushing the card up instead of letting the keyboard cover it.
  heroWrap: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  hero: { alignItems: 'center' },
  blobOne: {
    position: 'absolute',
    top: -90,
    right: -120,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blobTwo: {
    position: 'absolute',
    bottom: -70,
    left: -120,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  appName: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: 0.3, marginBottom: 6, textAlign: 'center' },
  tagline: { fontSize: 13.5, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.2, textAlign: 'center' },
  brandTagline: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
  },

  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flexShrink: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  title: { fontSize: 25, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 22 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    gap: 8,
  },
  errorText: { fontSize: 13, color: colors.danger, flex: 1 },

  label: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    marginBottom: 16,
    gap: 6,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  inputError: { borderColor: colors.danger },
  emailHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -10,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  emailHintText: { flex: 1, fontSize: 12, color: colors.warning },
  inputIcon: { marginRight: 4 },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary, padding: 0, includeFontPadding: false },
  eyeBtn: { padding: 4 },

  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    minHeight: 54,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: colors.white },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 13,
    minHeight: 50,
  },
  socialBtnText: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchHint: { fontSize: 14, color: colors.textSecondary },
  switchLink: { fontSize: 14, fontWeight: '800', color: colors.primary },
  poweredBy: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  poweredByText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.2 },
  poweredByBrand: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 0.2 },
});
