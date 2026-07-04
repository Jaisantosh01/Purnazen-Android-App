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
import useTheme from '../hooks/useTheme';

const LoginScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
    if (!password.trim()) { setError('Please enter your password.'); return; }
    setError('');
    setIsLoading(true);
    try {
      await authService.login(email.trim(), password);
      // Auth-state flip in authStore swaps the root navigator to Main (App.tsx).
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
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
            <MCIcon name="shield-check" size={38} color={colors.white} />
          </View>
          <Text style={styles.appName}>Wellness Admin</Text>
          <Text style={styles.tagline}>Secure Access Portal</Text>
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
          <Text style={styles.subtitle}>Enter your credentials to continue</Text>

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
              placeholder="admin@example.com"
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
                <Text style={styles.primaryBtnText}>Login</Text>
                <MCIcon name="arrow-right" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.note}>
            Admin accounts are provisioned by the Purnazen team — there is no
            self sign-up.
          </Text>
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
  appName: { fontSize: 30, fontWeight: '800', color: colors.white, letterSpacing: 0.3, marginBottom: 6, textAlign: 'center' },
  tagline: { fontSize: 13.5, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.2, textAlign: 'center' },

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
    backgroundColor: colors.danger + '14',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger + '55',
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
  note: {
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
