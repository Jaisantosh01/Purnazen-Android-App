import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import preferencesService from '../services/preferencesService';
import biometricService from '../services/biometricService';
import { checkForUpdate, FORCE_MARKER } from '../services/updateService';
import { APP_VERSION } from '../config';
import { useAuthStore } from '../store/authStore';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

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
};
const soft = hex => `${hex}22`;

const SUPPORT_EMAIL = 'support@purnazen.com';

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
  const headerTop = useHeaderTopPadding(16);
  const doctor = useAuthStore(state => state.doctor);
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
  const [updateChecking, setUpdateChecking]       = useState(false);

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
        showAlert('Biometric Login Enabled', `You can now unlock Purnazen Doctor with ${type || 'biometrics'}.`);
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
    setFullName(doctor?.full_name || '');
    setFormError('');
    setShowEditProfile(true);
  };

  const openEditPhone = () => {
    setPhone(doctor?.phone || '');
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

  // Manual "Check for Updates" — reuses the GitHub-release check the launch
  // prompt uses (force:true so it runs from dev builds too).
  const handleCheckForUpdate = async () => {
    if (updateChecking) return;
    setUpdateChecking(true);
    try {
      const u = await checkForUpdate({ force: true });
      if (!u) {
        showAlert('Up to date', `You're on the latest version (v${APP_VERSION}).`);
        return;
      }
      const openApk = () => { Linking.openURL(u.apkUrl).catch(() => {}); };
      const notes = (u.notes || '')
        .split('\n')
        .filter(l => !l.includes(FORCE_MARKER))
        .join('\n')
        .trim();
      const body =
        `Version ${u.version} is available${u.current ? ` (you have v${u.current})` : ''}.` +
        (u.forced ? '\n\nThis is a critical update and is required to continue.' : '') +
        (notes ? `\n\n${notes}` : '');
      const buttons = u.forced
        ? [{ text: 'Update now', onPress: openApk }]
        : [
            { text: 'Later', style: 'cancel' },
            { text: 'Update now', onPress: openApk },
          ];
      showAlert(
        u.forced ? 'Update required' : 'Update available',
        body,
        buttons,
        { cancelable: !u.forced },
      );
    } catch {
      showAlert('Check for Updates', 'Could not check for updates. Please try again later.');
    } finally {
      setUpdateChecking(false);
    }
  };

  const openSupport = () =>
    showAlert(
      'Help & Support',
      `Reach the Purnazen team at ${SUPPORT_EMAIL} for help with the doctor app.`,
    );

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          // Auth-state flip swaps the root navigator back to Login (App.tsx).
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your preferences</Text>
        </View>
      </View>

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
              valueText={doctor?.phone || 'NA'}
              onPress={openEditPhone}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="email-outline"
              hue={HUES.amber}
              title="Email Address"
              subtitle="Linked email"
              valueText={doctor?.email || 'NA'}
              onPress={() => showAlert('Email Address', 'Contact an admin to change your account email.')}
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

        {/* About */}
        <View style={styles.section}>
          <SectionHeader title="About" />
          <View style={styles.card}>
            <ArrowRow
              icon="cloud-download-outline"
              hue={HUES.blue}
              title="Check for Updates"
              subtitle={updateChecking ? 'Checking…' : `Current version v${APP_VERSION}`}
              valueText={updateChecking ? '…' : undefined}
              onPress={handleCheckForUpdate}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="help-circle-outline"
              hue={HUES.purple}
              title="Help & Support"
              subtitle="Get assistance"
              onPress={openSupport}
            />
          </View>
        </View>

        {/* Account actions */}
        <View style={styles.section}>
          <SectionHeader title="Account" />
          <View style={styles.card}>
            <ArrowRow
              icon="logout"
              hue={colors.danger}
              title="Logout"
              onPress={handleLogout}
            />
          </View>
        </View>

        <Text style={styles.version}>Purnazen Doctor v{APP_VERSION}</Text>
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

  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.white },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

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
