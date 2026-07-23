import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import socialAuthService from '../services/socialAuthService';
import preferencesService from '../services/preferencesService';
import biometricService from '../services/biometricService';
import { useAuthStore } from '../store/authStore';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

// Shared toggle ids with the backend user_preferences.notifications dict.
const PREF_KEYS = {
  appointmentAlerts: 'appointment',
};

// Per-row accent hues. The icon background is a translucent wash of the same hue
// (`soft()`) so the tint reads correctly over both light and dark cards.
const HUES = {
  primary: null, // resolved to colors.primary at render
  purple: '#7C3AED',
  blue: '#0284C7',
  amber: '#F59E0B',
  orange: '#EA580C',
  rose: '#E11D48',
};
const soft = hex => `${hex}22`;

// Supported app languages. The selected code persists to user_preferences;
// full UI translation (i18n) is wired separately.
const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English'   },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी'    },
  { code: 'mr', label: 'Marathi',  native: 'मराठी'     },
  { code: 'ta', label: 'Tamil',    native: 'தமிழ்'      },
  { code: 'te', label: 'Telugu',   native: 'తెలుగు'     },
  { code: 'bn', label: 'Bengali',  native: 'বাংলা'      },
];
const languageLabel = code => (LANGUAGES.find(l => l.code === code) || LANGUAGES[0]).label;

const SettingsScreen = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const { colors, isDark, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const tint = hue => hue || colors.primary;

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const ToggleRow = ({ icon, hue, title, subtitle, value, onToggle, disabled }) => {
    const c = tint(hue);
    return (
      <View style={styles.settingRow}>
        <View style={[styles.settingIconBox, { backgroundColor: soft(c) }]}>
          <MCIcon name={icon} size={20} color={c} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
    );
  };

  const ArrowRow = ({ icon, hue, title, subtitle, onPress, valueText, danger }) => {
    const c = danger ? colors.danger : tint(hue);
    return (
      <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.settingIconBox, { backgroundColor: soft(c) }]}>
          <MCIcon name={icon} size={20} color={c} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={danger ? styles.settingTitleDanger : styles.settingTitle}>{title}</Text>
          {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
        </View>
        {valueText
          ? <Text style={styles.valueText}>{valueText}</Text>
          : <MCIcon name="chevron-right" size={20} color={colors.borderStrong} />}
      </TouchableOpacity>
    );
  };

  const [notifications, setNotifications]         = useState(true);
  const [appointmentAlerts, setAppointmentAlerts] = useState(true);
  const [biometric, setBiometric]                 = useState(false);
  const [biometricBusy, setBiometricBusy]         = useState(false);
  const [language, setLanguage]                   = useState('en');

  // Hydrate toggles/values from the server (defaults kept offline).
  React.useEffect(() => {
    preferencesService.getPreferences()
      .then(prefs => {
        if (!prefs) return;
        if (typeof prefs.pushEnabled === 'boolean') setNotifications(prefs.pushEnabled);
        const saved = prefs.notifications || {};
        if (PREF_KEYS.appointmentAlerts in saved) setAppointmentAlerts(saved[PREF_KEYS.appointmentAlerts]);
        if (prefs.language) setLanguage(prefs.language);
      })
      .catch(err => console.log('Preferences fetch failed:', err.message));

    biometricService.isEnabled().then(setBiometric).catch(() => {});
  }, []);

  const savePreference = payload => {
    preferencesService.updatePreferences(payload)
      .catch(err => console.log('Preference save failed:', err.message));
  };

  const togglePush = value => {
    setNotifications(value);
    savePreference({ pushEnabled: value });
  };

  const makeToggle = (setter, prefKey) => value => {
    setter(value);
    savePreference({ notifications: { [prefKey]: value } });
  };

  // Language — persist immediately on select.
  const selectLanguage = code => {
    setLanguage(code);
    setShowLanguage(false);
    savePreference({ language: code });
  };

  // Dark mode is global — drives the persisted theme store via useTheme().
  const toggleDarkMode = value => setMode(value ? 'dark' : 'light');

  // Biometric login uses the device keystore biometric prompt to enrol/disenrol.
  const toggleBiometric = async value => {
    setBiometricBusy(true);
    try {
      if (value) {
        const type = await biometricService.enable();
        setBiometric(true);
        showAlert('Biometric Login Enabled', `You can now unlock Purnazen Admin with ${type || 'biometrics'}.`);
      } else {
        await biometricService.disable();
        setBiometric(false);
      }
    } catch (err) {
      setBiometric(false);
      showAlert('Biometric Login', err.message || 'Could not update biometric login.');
    } finally {
      setBiometricBusy(false);
    }
  };

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [fullName, setFullName]               = useState('');
  // Edit phone modal
  const [showEditPhone, setShowEditPhone] = useState(false);
  const [phone, setPhone]                 = useState('');
  // Change email modal + social linking
  const [showEditEmail, setShowEditEmail] = useState(false);
  const [newEmail, setNewEmail]           = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [linkBusy, setLinkBusy]           = useState(false);
  // Language modal
  const [showLanguage, setShowLanguage]   = useState(false);
  // Change password modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword]       = useState('');
  const [newPassword, setNewPassword]               = useState('');
  const [confirmPassword, setConfirmPassword]       = useState('');

  const [formError, setFormError]   = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openEditProfile = () => {
    setFullName(user?.full_name || '');
    setFormError('');
    setShowEditProfile(true);
  };

  const openEditPhone = () => {
    setPhone(user?.phone || '');
    setFormError('');
    setShowEditPhone(true);
  };

  const openChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFormError('');
    setShowChangePassword(true);
  };

  const openEditEmail = () => {
    setNewEmail(user?.email || '');
    setEmailPassword('');
    setFormError('');
    setShowEditEmail(true);
  };

  const handleSaveEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setFormError('Enter a valid email address.');
      return;
    }
    if (!user?.auth_provider && !emailPassword) {
      setFormError('Enter your current password to confirm.');
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.changeEmail(trimmed, emailPassword || null);
      setShowEditEmail(false);
      showAlert('Email Updated', 'Use the new email the next time you log in.');
    } catch (err) {
      setFormError(err.message || 'Could not update email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Linked social account: link via Google, or unlink the current one.
  const linkWith = async provider => {
    setLinkBusy(true);
    try {
      const updated = await socialAuthService.linkAccount(provider);
      if (updated) {
        showAlert('Account Linked', 'You can now sign in with that account.');
      }
    } catch (err) {
      showAlert('Linking Failed', err.message || 'Could not link the account.');
    } finally {
      setLinkBusy(false);
    }
  };

  const handleLinkedAccount = () => {
    if (linkBusy) return;
    if (user?.social_linked) {
      showAlert(
        'Linked Account',
        `This account is linked to ${user?.auth_provider || 'a social'} sign-in. Unlink it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unlink',
            style: 'destructive',
            onPress: async () => {
              try {
                await authService.unlinkSocial();
                showAlert('Unlinked', 'Social sign-in removed for this account.');
              } catch (err) {
                showAlert('Error', err.message || 'Could not unlink the account.');
              }
            },
          },
        ],
      );
    } else {
      showAlert('Link a Social Account', 'Sign in with the account you want to link.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Google', onPress: () => linkWith('google') },
      ]);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) { setFormError('Name cannot be empty.'); return; }
    setIsSubmitting(true);
    try {
      await authService.updateProfile({ fullName: fullName.trim() });
      setShowEditProfile(false);
      showAlert('Profile Updated', 'Your name has been updated.');
    } catch (err) {
      setFormError(err.message || 'Profile update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePhone = async () => {
    const trimmed = phone.trim();
    if (trimmed && !/^[+0-9 ()-]{6,15}$/.test(trimmed)) {
      setFormError('Enter a valid phone number.');
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.updateProfile({ phone: trimmed });
      setShowEditPhone(false);
      showAlert('Phone Updated', 'Your phone number has been saved.');
    } catch (err) {
      setFormError(err.message || 'Could not update phone number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword)               { setFormError('Enter your current password.'); return; }
    if (newPassword.length < 6)         { setFormError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setFormError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setShowChangePassword(false);
      showAlert('Password Changed', 'Your password has been updated.');
    } catch (err) {
      setFormError(err.message || 'Password change failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Settings" subtitle="Manage your preferences" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Account */}
        <View style={styles.section}>
          <SectionHeader title="Account" />
          <View style={styles.card}>
            <ArrowRow
              icon="account-edit-outline"
              title="Edit Profile"
              subtitle="Update your name"
              onPress={openEditProfile}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="lock-outline"
              hue={HUES.purple}
              title="Change Password"
              subtitle="Update your login password"
              onPress={openChangePassword}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="phone-outline"
              hue={HUES.blue}
              title="Phone Number"
              subtitle="Linked mobile number"
              valueText={user?.phone || 'NA'}
              onPress={openEditPhone}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="email-outline"
              hue={HUES.amber}
              title="Email Address"
              subtitle="Login email"
              valueText={user?.email || 'NA'}
              onPress={openEditEmail}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="link-variant"
              hue={HUES.rose}
              title="Linked Social Account"
              subtitle="Sign in with Google"
              valueText={
                linkBusy
                  ? 'Linking...'
                  : user?.social_linked
                  ? (user?.auth_provider
                      ? user.auth_provider.charAt(0).toUpperCase() + user.auth_provider.slice(1)
                      : 'Linked')
                  : 'Not linked'
              }
              onPress={handleLinkedAccount}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <SectionHeader title="Notifications" />
          <View style={styles.card}>
            <ToggleRow
              icon="bell-outline"
              title="Push Notifications"
              subtitle="Enable all app notifications"
              value={notifications}
              onToggle={togglePush}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="calendar-clock"
              hue={HUES.blue}
              title="Appointment Alerts"
              subtitle="New bookings & schedule changes"
              value={appointmentAlerts}
              onToggle={makeToggle(setAppointmentAlerts, PREF_KEYS.appointmentAlerts)}
            />
          </View>
        </View>

        {/* Appearance & Security */}
        <View style={styles.section}>
          <SectionHeader title="Appearance & Security" />
          <View style={styles.card}>
            <ToggleRow
              icon="weather-night"
              hue={colors.textSecondary}
              title="Dark Mode"
              subtitle="Switch to dark theme"
              value={isDark}
              onToggle={toggleDarkMode}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="fingerprint"
              title="Biometric Login"
              subtitle="Use fingerprint or Face ID"
              value={biometric}
              onToggle={toggleBiometric}
              disabled={biometricBusy}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="translate"
              hue={HUES.orange}
              title="Language"
              subtitle="App display language"
              valueText={languageLabel(language)}
              onPress={() => setShowLanguage(true)}
            />
          </View>
        </View>

        <Text style={styles.version}>Purnazen Admin</Text>
      </ScrollView>

      {/* Edit Profile modal */}
      <Modal visible={showEditProfile} transparent animationType="fade"
        onRequestClose={() => setShowEditProfile(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Text style={styles.modalLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={fullName}
              onChangeText={text => { setFullName(text); setFormError(''); }}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
            {formError ? <Text style={styles.modalError}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowEditProfile(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSaveProfile} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.modalBtnSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Phone modal */}
      <Modal visible={showEditPhone} transparent animationType="fade"
        onRequestClose={() => setShowEditPhone(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Phone Number</Text>
            <Text style={styles.modalLabel}>Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              value={phone}
              onChangeText={text => { setPhone(text); setFormError(''); }}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
            {formError ? <Text style={styles.modalError}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowEditPhone(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSavePhone} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.modalBtnSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Email modal */}
      <Modal visible={showEditEmail} transparent animationType="fade"
        onRequestClose={() => setShowEditEmail(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Email</Text>
            <Text style={styles.modalLabel}>New Email</Text>
            <TextInput
              style={styles.modalInput}
              value={newEmail}
              onChangeText={text => { setNewEmail(text); setFormError(''); }}
              placeholder="admin@example.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!user?.auth_provider && (
              <>
                <Text style={styles.modalLabel}>Current Password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={emailPassword}
                  onChangeText={text => { setEmailPassword(text); setFormError(''); }}
                  placeholder="Confirm with your password"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </>
            )}
            {formError ? <Text style={styles.modalError}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowEditEmail(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSaveEmail} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.modalBtnSaveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password modal */}
      <Modal visible={showChangePassword} transparent animationType="fade"
        onRequestClose={() => setShowChangePassword(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.modalLabel}>Current Password</Text>
            <TextInput
              style={styles.modalInput}
              value={currentPassword}
              onChangeText={text => { setCurrentPassword(text); setFormError(''); }}
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.modalLabel}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={text => { setNewPassword(text); setFormError(''); }}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.modalLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={text => { setConfirmPassword(text); setFormError(''); }}
              secureTextEntry
              placeholder="Repeat new password"
              placeholderTextColor={colors.textMuted}
            />
            {formError ? <Text style={styles.modalError}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowChangePassword(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleChangePassword} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.modalBtnSaveText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language selector modal */}
      <Modal visible={showLanguage} transparent animationType="fade"
        onRequestClose={() => setShowLanguage(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>App Language</Text>
            {LANGUAGES.map(l => {
              const active = language === l.code;
              return (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.langRow, active && styles.langRowActive]}
                  onPress={() => selectLanguage(l.code)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.langLabel}>{l.label}</Text>
                    <Text style={styles.langNative}>{l.native}</Text>
                  </View>
                  {active ? <MCIcon name="check-circle" size={20} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowLanguage(false)}>
                <Text style={styles.modalBtnCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SettingsScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowDivider: { height: 1, backgroundColor: colors.surfaceMuted, marginLeft: 64 },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  settingTitleDanger: { fontSize: 14, fontWeight: '600', color: colors.danger },
  settingSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  valueText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  // Language selector rows
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 8,
  },
  langRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  langLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  langNative: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.borderStrong,
    marginTop: 28,
  },

  // Plain-modal forms (edit profile / phone / password / language).
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
  },
  modalError: { fontSize: 12, color: colors.danger, marginTop: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalBtnCancel: { backgroundColor: colors.surfaceMuted },
  modalBtnSave: { backgroundColor: colors.primary, minWidth: 80, alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  modalBtnSaveText: { fontSize: 14, fontWeight: '600', color: colors.white },
});
