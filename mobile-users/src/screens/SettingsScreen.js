import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import preferencesService from '../services/preferencesService';
import biometricService from '../services/biometricService';
import { resetToLogin } from '../navigation/navigationRef';
import { useAuthStore } from '../store/authStore';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppDialog from '../components/AppDialog';
import FormInput from '../components/FormInput';

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

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.borderStrong,
    marginTop: 28,
  },
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
  const [locationAccess, setLocationAccess]       = useState(true);

  // Hydrate the notification toggles from the server (defaults kept offline)
  React.useEffect(() => {
    preferencesService.getPreferences()
      .then(prefs => {
        setNotifications(prefs.pushEnabled);
        const saved = prefs.notifications || {};
        if (PREF_KEYS.sessionReminders in saved) setSessionReminders(saved[PREF_KEYS.sessionReminders]);
        if (PREF_KEYS.appointmentAlerts in saved) setAppointmentAlerts(saved[PREF_KEYS.appointmentAlerts]);
        if (PREF_KEYS.promotionalEmails in saved) setPromotionalEmails(saved[PREF_KEYS.promotionalEmails]);
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
              onPress={() => Alert.alert('Update Phone', 'Coming soon!')}
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
              valueText="English"
              onPress={() => Alert.alert('Language', 'More languages coming soon!')}
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
              onToggle={setLocationAccess}
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

        <Text style={styles.version}>Purnazen v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile dialog */}
      <AppDialog
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        icon="account-edit-outline"
        title="Edit Profile"
        subtitle="Update the name shown across Purnazen"
        confirmLabel="Save"
        onConfirm={handleSaveProfile}
        confirmLoading={isSubmitting}
      >
        <FormInput
          label="Full Name"
          icon="account-outline"
          value={fullName}
          onChangeText={text => { setFullName(text); setFormError(''); }}
          placeholder="Your name"
          autoCapitalize="words"
          error={formError}
        />
      </AppDialog>

      {/* Change Password dialog */}
      <AppDialog
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        icon="lock-outline"
        iconColor={HUES.purple}
        iconBg={soft(HUES.purple)}
        title="Change Password"
        subtitle="Choose a strong password you don't reuse elsewhere"
        confirmLabel="Update"
        onConfirm={handleChangePassword}
        confirmLoading={isSubmitting}
      >
        <FormInput
          label="Current Password"
          icon="lock-outline"
          value={currentPassword}
          onChangeText={text => { setCurrentPassword(text); setFormError(''); }}
          secureTextEntry
          placeholder="Current password"
        />
        <FormInput
          label="New Password"
          icon="lock-plus-outline"
          value={newPassword}
          onChangeText={text => { setNewPassword(text); setFormError(''); }}
          secureTextEntry
          placeholder="At least 6 characters"
        />
        <FormInput
          label="Confirm New Password"
          icon="lock-check-outline"
          value={confirmPassword}
          onChangeText={text => { setConfirmPassword(text); setFormError(''); }}
          secureTextEntry
          placeholder="Repeat new password"
          error={formError}
        />
      </AppDialog>
    </View>
  );
};

export default SettingsScreen;
