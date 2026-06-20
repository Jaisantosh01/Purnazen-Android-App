import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import { COLORS } from '../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [focused, setFocused]           = useState(null); // 'email' | 'password'

  const scrollRef      = useRef(null);
  const passwordRef    = useRef(null);
  const emailFieldY    = useRef(0);
  const passwordFieldY = useRef(0);

  // Keep the focused field comfortably above the keyboard by scrolling the
  // sheet up to it (works on both platforms; iOS also gets KeyboardAvoidingView).
  const scrollToY = useCallback((y) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }, 100);
  }, []);

  const handleLogin = async () => {
    if (!email.trim())    { setError('Please enter your email.');    return; }
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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <View style={styles.topSection}>
            {/* soft decorative blobs for depth */}
            <View style={styles.blobOne} />
            <View style={styles.blobTwo} />

            <View style={styles.logoBadge}>
              <MCIcon name="leaf" size={38} color={COLORS.white} />
            </View>
            <Text style={styles.appName}>Purnazen</Text>
            <Text style={styles.tagline}>AI Assisted Acupressure & Wellness</Text>
          </View>

          {/* ── Form card ─────────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.handle} />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue your wellness journey</Text>

            {error.length > 0 && (
              <View style={styles.errorBox}>
                <MCIcon name="alert-circle-outline" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View
              style={[styles.inputContainer, focused === 'email' && styles.inputFocused]}
              onLayout={e => { emailFieldY.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}
            >
              <MCIcon name="email-outline" size={20} color={focused === 'email' ? COLORS.primary : COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={text => { setEmail(text); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => { setFocused('email'); scrollToY(emailFieldY.current); }}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View
              style={[styles.inputContainer, focused === 'password' && styles.inputFocused]}
              onLayout={e => { passwordFieldY.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}
            >
              <MCIcon name="lock-outline" size={20} color={focused === 'password' ? COLORS.primary : COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={text => { setPassword(text); setError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={() => { setFocused('password'); scrollToY(passwordFieldY.current); }}
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
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                  <MCIcon name="arrow-right" size={20} color={COLORS.white} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchHint}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                <Text style={styles.switchLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.keyboardSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: COLORS.primary },
  flex:  { flex: 1 },
  scroll: { flexGrow: 1, minHeight: SCREEN_H },

  topSection: {
    alignItems: 'center',
    paddingTop: 76,
    paddingBottom: 60,
    overflow: 'hidden',
  },
  blobOne: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  blobTwo: {
    position: 'absolute',
    top: 60,
    left: -50,
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
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },

  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    marginTop: -28,
    flexGrow: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginBottom: 22,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 26,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    marginBottom: 18,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    padding: 0,
    includeFontPadding: false,
  },
  eyeBtn: { padding: 4 },

  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    minHeight: 54,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  switchHint: { fontSize: 14, color: COLORS.textSecondary },
  switchLink:  { fontSize: 14, fontWeight: '800', color: COLORS.primary },

  keyboardSpacer: { height: 220 },
});
