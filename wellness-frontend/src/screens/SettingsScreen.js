import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { resetToLogin } from '../navigation/navigationRef';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#1FA77A',
    paddingTop: 50,
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
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 64 },

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
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  settingTitleDanger: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  settingSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  valueText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 28,
  },

  // Modal forms (edit profile / change password)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  modalError: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalBtnCancel: { backgroundColor: '#f3f4f6' },
  modalBtnSave: { backgroundColor: '#1FA77A', minWidth: 80, alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  modalBtnSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

const SectionHeader = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

const ToggleRow = ({ icon, iconColor = '#1FA77A', iconBg = '#e8f8f2', title, subtitle, value, onToggle }) => (
  <View style={styles.settingRow}>
    <View style={[styles.settingIconBox, { backgroundColor: iconBg }]}>
      <MCIcon name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingInfo}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#e5e7eb', true: '#1FA77A' }}
      thumbColor="#fff"
    />
  </View>
);

const ArrowRow = ({ icon, iconColor = '#1FA77A', iconBg = '#e8f8f2', title, subtitle, onPress, valueText, danger }) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.settingIconBox, { backgroundColor: iconBg }]}>
      <MCIcon name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingInfo}>
      <Text style={danger ? styles.settingTitleDanger : styles.settingTitle}>{title}</Text>
      {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
    </View>
    {valueText
      ? <Text style={styles.valueText}>{valueText}</Text>
      : <MCIcon name="chevron-right" size={20} color="#d1d5db" />}
  </TouchableOpacity>
);

const SettingsScreen = ({ navigation }) => {
  const user = useAuthStore(state => state.user);

  const [notifications, setNotifications]         = useState(true);
  const [sessionReminders, setSessionReminders]   = useState(true);
  const [appointmentAlerts, setAppointmentAlerts] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);
  const [darkMode, setDarkMode]                   = useState(false);
  const [biometric, setBiometric]                 = useState(false);
  const [locationAccess, setLocationAccess]       = useState(true);

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
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
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
              subtitle="Update name, photo & bio"
              onPress={openEditProfile}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="lock-outline"
              iconColor="#7c3aed"
              iconBg="#F3EEFF"
              title="Change Password"
              subtitle="Update your login password"
              onPress={openChangePassword}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="phone-outline"
              iconColor="#0284c7"
              iconBg="#E0F2FE"
              title="Phone Number"
              subtitle="Linked mobile number"
              valueText="+91 98765 XXXXX"
              onPress={() => Alert.alert('Update Phone', 'Coming soon!')}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="email-outline"
              iconColor="#f59e0b"
              iconBg="#FFFBEB"
              title="Email Address"
              subtitle="Linked email"
              valueText={user?.email || '—'}
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
              onToggle={setNotifications}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="yoga"
              iconColor="#7c3aed"
              iconBg="#F3EEFF"
              title="Session Reminders"
              subtitle="Daily wellness session alerts"
              value={sessionReminders}
              onToggle={setSessionReminders}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="calendar-clock"
              iconColor="#0284c7"
              iconBg="#E0F2FE"
              title="Appointment Alerts"
              subtitle="Reminders before consultations"
              value={appointmentAlerts}
              onToggle={setAppointmentAlerts}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="tag-outline"
              iconColor="#f59e0b"
              iconBg="#FFFBEB"
              title="Promotional Emails"
              subtitle="Offers, tips & newsletters"
              value={promotionalEmails}
              onToggle={setPromotionalEmails}
            />
          </View>
        </View>

        {/* Appearance & Security */}
        <View style={styles.section}>
          <SectionHeader title="Appearance & Security" />
          <View style={styles.card}>
            <ToggleRow
              icon="weather-night"
              iconColor="#6b7280"
              iconBg="#f3f4f6"
              title="Dark Mode"
              subtitle="Switch to dark theme"
              value={darkMode}
              onToggle={setDarkMode}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="fingerprint"
              iconColor="#1FA77A"
              iconBg="#e8f8f2"
              title="Biometric Login"
              subtitle="Use fingerprint or face ID"
              value={biometric}
              onToggle={setBiometric}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="translate"
              iconColor="#ea580c"
              iconBg="#FFF3E0"
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
              iconColor="#D46F6F"
              iconBg="#FFEEEE"
              title="Location Access"
              subtitle="Used for nearby doctor search"
              value={locationAccess}
              onToggle={setLocationAccess}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="download-outline"
              iconColor="#0284c7"
              iconBg="#E0F2FE"
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
              iconColor="#ef4444"
              iconBg="#FFF5F5"
              title="Logout"
              onPress={handleLogout}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="delete-outline"
              iconColor="#ef4444"
              iconBg="#FFF5F5"
              title="Delete Account"
              subtitle="Permanently remove all your data"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        <Text style={styles.version}>M-Heal v1.0.0</Text>
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
              placeholderTextColor="#9ca3af"
            />
            {formError ? <Text style={styles.modalError}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowEditProfile(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleSaveProfile}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnSaveText}>Save</Text>}
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
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.modalLabel}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={text => { setNewPassword(text); setFormError(''); }}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.modalLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={text => { setConfirmPassword(text); setFormError(''); }}
              secureTextEntry
              placeholder="Repeat new password"
              placeholderTextColor="#9ca3af"
            />
            {formError ? <Text style={styles.modalError}>{formError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowChangePassword(false)}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={handleChangePassword}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnSaveText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SettingsScreen;
