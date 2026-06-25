import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import authService from '../services/authService';
import FormInput from '../components/FormInput';

const GENDERS = [
  { value: 'Male', icon: 'gender-male' },
  { value: 'Female', icon: 'gender-female' },
  { value: 'Other', icon: 'gender-non-binary' },
];

const pad2 = v => (v.length === 1 ? `0${v}` : v);

const ProfileCompletionScreen = () => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore(s => s.user);
  const setPendingCompletion = useProfileStore(s => s.setPendingCompletion);

  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yyyy, setYyyy] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const mmRef = useRef(null);
  const yyyyRef = useRef(null);

  const finish = () => setPendingCompletion(false);

  const validateDob = () => {
    if (!dd && !mm && !yyyy) return { ok: true, iso: undefined };
    const d = parseInt(dd, 10);
    const m = parseInt(mm, 10);
    const y = parseInt(yyyy, 10);
    const now = new Date();
    if (!d || !m || !y || yyyy.length !== 4) return { ok: false };
    if (m < 1 || m > 12 || d < 1 || d > 31) return { ok: false };
    if (y < 1900 || y > now.getFullYear()) return { ok: false };
    const dob = new Date(y, m - 1, d);
    if (dob > now) return { ok: false };
    return { ok: true, iso: `${y}-${pad2(mm)}-${pad2(dd)}` };
  };

  const handleSave = async () => {
    setError('');
    if (phone && !/^[+0-9 ()-]{6,15}$/.test(phone.trim())) {
      setError('Enter a valid phone number.');
      return;
    }
    const dob = validateDob();
    if (!dob.ok) {
      setError('Enter a valid date of birth.');
      return;
    }
    setSaving(true);
    try {
      await authService.updateProfile({
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        dateOfBirth: dob.iso,
      });
      finish();
    } catch (err) {
      setError(err.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const firstName = (user?.full_name || '').trim().split(' ')[0] || 'there';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MCIcon name="account-heart-outline" size={30} color={colors.white} />
        </View>
        <Text style={styles.heroTitle}>Welcome, {firstName}!</Text>
        <Text style={styles.heroSub}>
          Add a few details so we can personalise your wellness care. You can skip and do this later.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Gender */}
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {GENDERS.map(g => {
              const active = gender === g.value;
              return (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.genderChip, active && styles.genderChipActive]}
                  onPress={() => setGender(active ? '' : g.value)}
                  activeOpacity={0.85}
                >
                  <MCIcon name={g.icon} size={18} color={active ? colors.white : colors.textSecondary} />
                  <Text style={[styles.genderText, active && styles.genderTextActive]}>{g.value}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Phone */}
          <FormInput
            label="Phone Number"
            icon="phone-outline"
            value={phone}
            onChangeText={t => { setPhone(t); setError(''); }}
            placeholder="+91 98765 43210"
            keyboardType="phone-pad"
            containerStyle={styles.field}
          />

          {/* Date of birth */}
          <Text style={styles.label}>Date of Birth</Text>
          <View style={styles.dobRow}>
            <View style={styles.dobBox}>
              <TextInput
                style={styles.dobInput}
                value={dd}
                onChangeText={t => {
                  const v = t.replace(/[^0-9]/g, '').slice(0, 2);
                  setDd(v); setError('');
                  if (v.length === 2) mmRef.current?.focus();
                }}
                placeholder="DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <Text style={styles.dobSep}>/</Text>
            <View style={styles.dobBox}>
              <TextInput
                ref={mmRef}
                style={styles.dobInput}
                value={mm}
                onChangeText={t => {
                  const v = t.replace(/[^0-9]/g, '').slice(0, 2);
                  setMm(v); setError('');
                  if (v.length === 2) yyyyRef.current?.focus();
                }}
                placeholder="MM"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <Text style={styles.dobSep}>/</Text>
            <View style={[styles.dobBox, styles.dobYear]}>
              <TextInput
                ref={yyyyRef}
                style={styles.dobInput}
                value={yyyy}
                onChangeText={t => { setYyyy(t.replace(/[^0-9]/g, '').slice(0, 4)); setError(''); }}
                placeholder="YYYY"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.saveText}>Save & Continue</Text>
                <MCIcon name="arrow-right" size={20} color={colors.white} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={finish} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ProfileCompletionScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },

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

  body: { padding: 24, paddingBottom: 40 },
  label: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, marginLeft: 2 },
  field: { marginBottom: 18 },

  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  genderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  genderChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { fontSize: 13.5, fontWeight: '600', color: colors.textSecondary },
  genderTextActive: { color: colors.white },

  dobRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dobBox: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    alignItems: 'center',
  },
  dobYear: { flex: 1.4 },
  dobInput: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    padding: 0,
    includeFontPadding: false,
    width: '100%',
  },
  dobSep: { fontSize: 18, color: colors.textMuted, fontWeight: '700' },

  error: { fontSize: 13, color: colors.danger, marginTop: 14 },

  saveBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 26,
    minHeight: 54,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveText: { fontSize: 16, fontWeight: '800', color: colors.white },
  skipBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  skipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
});
