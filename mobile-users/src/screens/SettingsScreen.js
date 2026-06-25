import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import preferencesService from '../services/preferencesService';
import biometricService from '../services/biometricService';
import permissionsService from '../services/permissionsService';
import { checkForUpdate, FORCE_MARKER } from '../services/updateService';
import { APP_VERSION } from '../config';
import { resetToLogin } from '../navigation/navigationRef';
import { useAuthStore } from '../store/authStore';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

// Shared toggle ids with NotificationsScreen (user_preferences.notifications)
const PREF_KEYS = {
  sessionReminders: 'session_reminder',
  appointmentAlerts: 'appointment',
  promotionalEmails: 'offers',
};

// Per-row accent hues. The icon background is a translucent wash of the same
// hue (`soft()`), so the tint reads correctly over both light and dark cards
// instead of the old fixed pastel fills that glowed in dark mode.
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

const makeStyles = COLORS => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowDivider: { height: 1, backgroundColor: COLORS.surfaceMuted, marginLeft: 64 },

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
  settingTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  settingTitleDanger: { fontSize: 14, fontWeight: '600', color: COLORS.danger },
  settingSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  valueText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },

  // Language selector rows (inside AppDialog)
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    marginBottom: 8,
  },
  langRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaint },
  langLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  langNative: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 1 },

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.borderStrong,
    marginTop: 28,
  },

  // Plain-modal forms (edit profile / phone / password / language / address) —
  // standardized on the admin app's modal style.
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceMuted,
  },
  modalInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  modalError: { fontSize: 12, color: COLORS.danger, marginTop: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  modalBtnCancel: { backgroundColor: COLORS.surfaceMuted },
  modalBtnSave: { backgroundColor: COLORS.primary, minWidth: 80, alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modalBtnSaveText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
});

const SettingsScreen = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const { colors, isDark, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Inline rows so they pick up the active (themed) styles + palette.
  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  // hue → saturated icon foreground; soft(hue) → translucent themed background.
  const tint = hue => hue || colors.primary;

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
  const [sessionReminders, setSessionReminders]   = useState(true);
  const [appointmentAlerts, setAppointmentAlerts] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);
  const [biometric, setBiometric]                 = useState(false);
  const [biometricBusy, setBiometricBusy]         = useState(false);
  const [locationAccess, setLocationAccess]       = useState(false);
  const [locationBusy, setLocationBusy]           = useState(false);
  const [language, setLanguage]                   = useState('en');
  const [address, setAddress]                     = useState('');
  const [updateChecking, setUpdateChecking]       = useState(false);

  // Hydrate the toggles/values from the server (defaults kept offline)
  React.useEffect(() => {
    preferencesService.getPreferences()
      .then(prefs => {
        setNotifications(prefs.pushEnabled);
        const saved = prefs.notifications || {};
        if (PREF_KEYS.sessionReminders in saved) setSessionReminders(saved[PREF_KEYS.sessionReminders]);
        if (PREF_KEYS.appointmentAlerts in saved) setAppointmentAlerts(saved[PREF_KEYS.appointmentAlerts]);
        if (PREF_KEYS.promotionalEmails in saved) setPromotionalEmails(saved[PREF_KEYS.promotionalEmails]);
        if (prefs.language) setLanguage(prefs.language);
        if (prefs.address != null) setAddress(prefs.address);
        if (typeof prefs.locationEnabled === 'boolean') setLocationAccess(prefs.locationEnabled);
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

  // Address editor.
  const openAddress = () => { setAddressDraft(address); setFormError(''); setShowAddress(true); };
  const handleSaveAddress = () => {
    const trimmed = addressDraft.trim();
    setAddress(trimmed);
    setShowAddress(false);
    savePreference({ address: trimmed });
  };

  // Location — request the real OS permission, then persist the enabled flag.
  const toggleLocation = async value => {
    if (!value) {
      setLocationAccess(false);
      savePreference({ locationEnabled: false });
      return;
    }
    setLocationBusy(true);
    try {
      const granted = await permissionsService.enable('location');
      setLocationAccess(granted);
      savePreference({ locationEnabled: granted });
      if (!granted) {
        Alert.alert(
          'Location Permission',
          'Location access was not granted. You can enable it from your device Settings.',
        );
      }
    } catch {
      setLocationAccess(false);
    } finally {
      setLocationBusy(false);
    }
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
        Alert.alert('Biometric Login Enabled', `You can now unlock Purnazen with ${type || 'biometrics'}.`);
      } else {
        await biometricService.disable();
        setBiometric(false);
      }
    } catch (err) {
      setBiometric(false);
      Alert.alert('Biometric Login', err.message || 'Could not update biometric login.');
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
  // Language + address modals
  const [showLanguage, setShowLanguage]   = useState(false);
  const [showAddress, setShowAddress]     = useState(false);
  const [addressDraft, setAddressDraft]   = useState('');
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
      Alert.alert('Phone Updated', 'Your phone number has been saved.');
    } catch (err) {
      setFormError(err.message || 'Could not update phone number.');
    } finally {
      setIsSubmitting(false);
    }
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
      Alert.alert('Profile Updated', 'Your name has been updated.');
    } catch (err) {
      setFormError(err.message || 'Profile update failed.');
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
      Alert.alert('Password Changed', 'Your password has been updated.');
    } catch (err) {
      setFormError(err.message || 'Password change failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manual "Check for Updates". Reuses the same GitHub-release check the launch
  // prompt uses (force:true so it runs from dev builds too). A forced/critical
  // release (notes contain the force marker) offers only "Update now"; otherwise
  // the user can defer. "Up to date" is reported when no newer release exists.
  const handleCheckForUpdate = async () => {
    if (updateChecking) return;
    setUpdateChecking(true);
    try {
      const u = await checkForUpdate({ force: true });
      if (!u) {
        Alert.alert('Up to date', `You're on the latest version (v${APP_VERSION}).`);
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
      Alert.alert(
        u.forced ? 'Update required' : 'Update available',
        body,
        buttons,
        { cancelable: !u.forced },
      );
    } catch {
      Alert.alert('Check for Updates', 'Could not check for updates. Please try again later.');
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await authService.logout();
          resetToLogin();
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.deleteAccount();
              resetToLogin();
            } catch (err) {
              Alert.alert('Deletion Failed', err.message || 'Please try again later.');
            }
          },
        },
      ]
    );
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
              subtitle="Update name, photo & bio"
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
              subtitle="Linked email"
              valueText={user?.email || 'NA'}
              onPress={() => {}}
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
              icon="yoga"
              hue={HUES.purple}
              title="Session Reminders"
              subtitle="Daily wellness session alerts"
              value={sessionReminders}
              onToggle={makeToggle(setSessionReminders, PREF_KEYS.sessionReminders)}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="calendar-clock"
              hue={HUES.blue}
              title="Appointment Alerts"
              subtitle="Reminders before consultations"
              value={appointmentAlerts}
              onToggle={makeToggle(setAppointmentAlerts, PREF_KEYS.appointmentAlerts)}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="tag-outline"
              hue={HUES.amber}
              title="Promotional Emails"
              subtitle="Offers, tips & newsletters"
              value={promotionalEmails}
              onToggle={makeToggle(setPromotionalEmails, PREF_KEYS.promotionalEmails)}
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

        {/* Privacy */}
        <View style={styles.section}>
          <SectionHeader title="Privacy" />
          <View style={styles.card}>
            <ToggleRow
              icon="map-marker-outline"
              hue={HUES.rose}
              title="Location Access"
              subtitle="Used for nearby doctor search"
              value={locationAccess}
              onToggle={toggleLocation}
              disabled={locationBusy}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="home-map-marker"
              hue={HUES.amber}
              title="Address"
              subtitle="Used for home visits & nearby search"
              valueText={address ? 'Edit' : 'Add'}
              onPress={openAddress}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="shield-account-outline"
              hue={HUES.purple}
              title="Privacy & Data Consent"
              subtitle="Manage scan storage & AI consents"
              onPress={() => navigation.navigate('Consent')}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="download-outline"
              hue={HUES.blue}
              title="Download My Data"
              subtitle="Export your health records"
              onPress={() => Alert.alert('Download Data', 'Your data export will be emailed within 24 hours.')}
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
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <SectionHeader title="Danger Zone" />
          <View style={styles.card}>
            <ArrowRow
              icon="logout"
              hue={colors.danger}
              title="Logout"
              onPress={handleLogout}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="delete-outline"
              title="Delete Account"
              subtitle="Permanently remove all your data"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        <Text style={styles.version}>Purnazen v{APP_VERSION}</Text>
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

      {/* Address editor modal */}
      <Modal visible={showAddress} transparent animationType="fade"
        onRequestClose={() => setShowAddress(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Your Address</Text>
            <Text style={styles.modalLabel}>Address</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline]}
              value={addressDraft}
              onChangeText={setAddressDraft}
              placeholder="House / street, area, city, pincode"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setShowAddress(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={handleSaveAddress}>
                <Text style={styles.modalBtnSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SettingsScreen;
