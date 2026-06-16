import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import { COLORS } from '../constants/theme';

const { height: SCREEN_H } = Dimensions.get('window');
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const RegisterScreen = ({ navigation }) => {
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [focused, setFocused]           = useState(null); // 'name' | 'email' | 'password' | 'confirm'

  const scrollRef   = useRef(null);
  const emailRef    = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef  = useRef(null);

  // Bottom-edge Y of each field within the scroll content, so we can lift the
  // focused field above the keyboard.
  const fieldY = useRef({ name: 0, email: 0, password: 0, confirm: 0 });

  const scrollToY = useCallback((y) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }, 100);
  }, []);

  const focusField = useCallback((key) => {
    setFocused(key);
    scrollToY(fieldY.current[key]);
  }, [scrollToY]);

  const handleRegister = async () => {
    if (!fullName.trim())             { setError('Please enter your name.');                 return; }
    if (!EMAIL_RE.test(email.trim())) { setError('Please enter a valid email.');             return; }
    if (password.length < 6)          { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)         { setError('Passwords do not match.');                 return; }
    setError('');
    setIsLoading(true);
    try {
      await authService.register(fullName.trim(), email.trim(), password);
      // Navigation handled by App.tsx auth-state listener
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
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
            <View style={styles.blobOne} />
            <View style={styles.blobTwo} />

            <View style={styles.logoBadge}>
              <MCIcon name="leaf" size={34} color={COLORS.white} />
            </View>
            <Text style={styles.appName}>Purnazen</Text>
            <Text style={styles.tagline}>AI Assisted Acupressure & Wellness</Text>
          </View>

          {/* ── Form card ─────────────────────────────────────────────────── */}
          <View style={styles.card}>
            <View style={styles.handle} />
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Sign up to begin your wellness journey</Text>

            {error.length > 0 && (
              <View style={styles.errorBox}>
                <MCIcon name="alert-circle-outline" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Full name */}
            <Text style={styles.label}>Full Name</Text>
            <View
              style={[styles.inputContainer, focused === 'name' && styles.inputFocused]}
              onLayout={e => { fieldY.current.name = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}
            >
              <MCIcon name="account-outline" size={20} color={focused === 'name' ? COLORS.primary : COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textMuted}
                value={fullName}
                onChangeText={text => { setFullName(text); setError(''); }}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                onFocus={() => focusField('name')}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <View
              style={[styles.inputContainer, focused === 'email' && styles.inputFocused]}
              onLayout={e => { fieldY.current.email = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}
            >
              <MCIcon name="email-outline" size={20} color={focused === 'email' ? COLORS.primary : COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
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
                onFocus={() => focusField('email')}
                onBlur={() => setFocused(null)}
              />
            </View>

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View
              style={[styles.inputContainer, focused === 'password' && styles.inputFocused]}
              onLayout={e => { fieldY.current.password = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}
            >
              <MCIcon name="lock-outline" size={20} color={focused === 'password' ? COLORS.primary : COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={text => { setPassword(text); setError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                onFocus={() => focusField('password')}
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

            {/* Confirm password */}
            <Text style={styles.label}>Confirm Password</Text>
            <View
              style={[styles.inputContainer, focused === 'confirm' && styles.inputFocused]}
              onLayout={e => { fieldY.current.confirm = e.nativeEvent.layout.y + e.nativeEvent.layout.height; }}
            >
              <MCIcon name="lock-check-outline" size={20} color={focused === 'confirm' ? COLORS.primary : COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={confirmRef}
                style={styles.input}
                placeholder="Repeat your password"
                placeholderTextColor={COLORS.textMuted}
                value={confirm}
                onChangeText={text => { setConfirm(text); setError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                onFocus={() => focusField('confirm')}
                onBlur={() => setFocused(null)}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              activeOpacity={0.85}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Sign Up</Text>
                  <MCIcon name="arrow-right" size={20} color={COLORS.white} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchHint}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                <Text style={styles.switchLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.keyboardSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: COLORS.primary },
  flex:  { flex: 1 },
  scroll: { flexGrow: 1, minHeight: SCREEN_H },

  topSection: {
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 48,
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
    top: 50,
    left: -50,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  appName: {
    fontSize: 30,
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

  keyboardSpacer: { height: 240 },
});
