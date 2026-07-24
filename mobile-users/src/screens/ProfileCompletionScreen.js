import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
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
import GenderSelect from '../components/GenderSelect';
import DobInput, { validateDobParts } from '../components/DobInput';
import { isValidPhone } from '../utils/validators';

const ProfileCompletionScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore(s => s.user);
  const setPendingCompletion = useProfileStore(s => s.setPendingCompletion);

  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState({ dd: '', mm: '', yyyy: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const finish = () => setPendingCompletion(false);

  const handleSave = async () => {
    setError('');
    if (phone && !isValidPhone(phone)) {
      setError('Enter a valid phone number.');
      return;
    }
    const parsedDob = validateDobParts(dob);
    if (!parsedDob.ok) {
      setError('Enter a valid date of birth.');
      return;
    }
    setSaving(true);
    try {
      await authService.updateProfile({
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        dateOfBirth: parsedDob.iso,
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
          <View style={styles.field}>
            <GenderSelect value={gender} onChange={setGender} />
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
          <DobInput value={dob} onChange={d => { setDob(d); setError(''); }} />

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
