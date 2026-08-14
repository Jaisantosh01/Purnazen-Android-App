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
import authService from '../services/authService';
import socialAuthService from '../services/socialAuthService';
import useTheme from '../hooks/useTheme';
import { STRINGS } from '../constants/strings';
import { isValidEmail } from '../utils/validators';

const LoginScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null); // 'google' | 'github'
  const [focused, setFocused] = useState(null); // 'email' | 'password'
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Keyboard-aware layout. The Android window does not reliably resize on its
  // own (RN edge-to-edge), so we lift the bottom-anchored card by the keyboard
  // height ourselves. `pad` animates layout (non-native), `kb` collapses the
  // hero (native). 0 = keyboard hidden, 1 = visible.
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

  const handleLogin = async () => {
    if (!email.trim()) { setError('Please enter your email.'); return; }
    if (!isValidEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (!password.trim()) { setError('Please enter your password.'); return; }
    setError('');
    setIsLoading(true);
    try {
      await authService.login(email.trim(), password);
      // Navigation handled by App.tsx auth-state listener
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async provider => {
    if (isLoading || socialLoading) return;
    setError('');
    setSocialLoading(provider);
    try {
      // Resolves to null when the user cancels the provider dialog — no error.
      // On success, navigation is handled by the App.tsx auth-state listener.
      await (provider === 'google'
        ? socialAuthService.signInWithGoogle()
        : socialAuthService.signInWithGitHub());
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
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

  return (
    <Animated.View style={[styles.root, { paddingBottom: pad }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* ── Hero (collapses under the keyboard) ─────────────────────────── */}
      <View style={styles.heroWrap}>
        <Animated.View style={[styles.hero, heroAnimStyle]}>
          <View style={styles.blobOne} />
          <View style={styles.blobTwo} />
          <View style={styles.logoBadge}>
            <MCIcon name="leaf" size={38} color={colors.white} />
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
          contentContainerStyle={styles.cardContent}
          bounces={false}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your wellness journey</Text>

          {error.length > 0 && (
            <View style={styles.errorBox}>
              <MCIcon name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <Pressable onPress={() => emailRef.current?.focus()} style={[styles.inputContainer, focused === 'email' && styles.inputFocused]}>
            <MCIcon name="email-outline" size={20} color={focused === 'email' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={t => { setEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
            />
          </Pressable>

          <Text style={styles.label}>Password</Text>
          <Pressable onPress={() => passwordRef.current?.focus()} style={[styles.inputContainer, focused === 'password' && styles.inputFocused]}>
            <MCIcon name="lock-outline" size={20} color={focused === 'password' ? colors.primary : colors.textMuted} style={styles.inputIcon} />
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={t => { setPassword(t); setError(''); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(p => !p)}
              style={styles.eyeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MCIcon name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Pressable>

          <TouchableOpacity
            style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Sign In</Text>
                <MCIcon name="arrow-right" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity
              style={styles.socialBtn}
              activeOpacity={0.8}
              onPress={() => handleSocialLogin('google')}
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
            <Text style={styles.switchHint}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
              <Text style={styles.switchLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  );
};

export default LoginScreen;

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
    width: 84,
    height: 84,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  appName: { fontSize: 32, fontWeight: '800', color: colors.white, letterSpacing: 0.3, marginBottom: 6, textAlign: 'center' },
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
    marginBottom: 18,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  inputIcon: { marginRight: 10 },
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
    marginTop: 6,
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
});
