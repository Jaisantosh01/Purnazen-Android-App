import React, { useState } from 'react';
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
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import { COLORS } from '../constants/theme';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

const RegisterScreen = ({ navigation }) => {
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim())          { setError('Please enter your name.');                 return; }
    if (!EMAIL_RE.test(email.trim())) { setError('Please enter a valid email.');          return; }
    if (password.length < 6)       { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)      { setError('Passwords do not match.');                 return; }
    setError('');
    setIsLoading(true);
    try {
      await authService.register(fullName.trim(), email.trim(), password);
      // Auth-state flip in authStore swaps the root navigator to Main (App.tsx).
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Top green section */}
        <View style={styles.topSection}>
          <View style={styles.logoCircle}>
            <MCIcon name="leaf" size={40} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>Wellness</Text>
          <Text style={styles.tagline}>Your health, our priority</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>

          {error.length > 0 && (
            <View style={styles.errorBox}>
              <MCIcon name="alert-circle-outline" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputContainer}>
            <MCIcon name="account-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={COLORS.textMuted}
              value={fullName}
              onChangeText={text => { setFullName(text); setError(''); }}
            />
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputContainer}>
            <MCIcon name="email-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={text => { setEmail(text); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <MCIcon name="lock-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={text => { setPassword(text); setError(''); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(prev => !prev)}
              style={styles.eyeBtn}
            >
              <MCIcon
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <MCIcon name="lock-check-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Repeat your password"
              placeholderTextColor={COLORS.textMuted}
              value={confirm}
              onChangeText={text => { setConfirm(text); setError(''); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, isLoading && styles.registerBtnDisabled]}
            activeOpacity={0.85}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.registerBtnText}>
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },

  scroll: { flexGrow: 1 },

  topSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 24,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    padding: 0,
  },
  eyeBtn: { padding: 4 },

  registerBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  registerBtnDisabled: {
    opacity: 0.7,
  },
  registerBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginHint: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
