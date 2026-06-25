import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { showError, showSuccess } from '../utils/toast';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { checkForUpdate, FORCE_MARKER } from '../services/updateService';
import { APP_VERSION } from '../config';

const ProfileScreen = () => {
  const doctor = useAuthStore(s => s.doctor);
  const [loggingOut, setLoggingOut] = useState(false);

  const name = doctor?.full_name || doctor?.name || 'Doctor';
  const email = doctor?.email || '';

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  // Change password modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);

  const openEditProfile = () => {
    setFullName(doctor?.full_name || '');
    setFormError('');
    setShowEditProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) { setFormError('Name cannot be empty.'); return; }
    setIsSubmitting(true);
    try {
      await authService.updateProfile({ fullName: fullName.trim() });
      setShowEditProfile(false);
      showSuccess('Your name has been updated.');
    } catch (err) {
      setFormError(err.message || 'Profile update failed.');
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

  const handleChangePassword = async () => {
    if (!currentPassword) { setFormError('Enter your current password.'); return; }
    if (newPassword.length < 6) { setFormError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setFormError('Passwords do not match.'); return; }
    setIsSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setShowChangePassword(false);
      showSuccess('Your password has been updated.');
    } catch (err) {
      setFormError(err.message || 'Password change failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manual "Check for Updates" — same GitHub-release check the launch prompt
  // uses (force:true so it runs from dev builds too).
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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
      // Navigation handled by App.tsx auth-state listener
    } catch (err) {
      showError(err.message || 'Could not log out.');
    } finally {
      setLoggingOut(false);
    }
  };

  const Row = ({ icon, label, value, onPress, last }) => (
    <TouchableOpacity
      style={[styles.row, last && styles.rowLast]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <MCIcon name={icon} size={22} color={COLORS.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      <MCIcon name="chevron-right" size={22} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <MCIcon name="doctor" size={34} color={COLORS.primary} />
          </View>
          <Text style={styles.name}>{name}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>

        <View style={styles.list}>
          <Row icon="account-edit-outline" label="Edit profile" onPress={openEditProfile} />
          <Row icon="lock-reset" label="Change password" onPress={openChangePassword} />
          <Row
            icon="cloud-download-outline"
            label="Check for updates"
            value={updateChecking ? 'Checking…' : `v${APP_VERSION}`}
            onPress={handleCheckForUpdate}
          />
          <Row
            icon="lifebuoy"
            label="Help & support"
            onPress={() => Alert.alert('Help & Support', 'Reach the Purnazen team at support@purnazen.com.')}
            last
          />
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.85}
          onPress={handleLogout}
          disabled={loggingOut}>
          {loggingOut ? (
            <ActivityIndicator color={COLORS.danger} />
          ) : (
            <>
              <MCIcon name="logout" size={20} color={COLORS.danger} />
              <Text style={styles.logoutText}>Log out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.note}>Purnazen Doctor v{APP_VERSION}</Text>
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
              placeholderTextColor={COLORS.textMuted}
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
                  ? <ActivityIndicator size="small" color={COLORS.white} />
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
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.modalLabel}>New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={newPassword}
              onChangeText={text => { setNewPassword(text); setFormError(''); }}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.modalLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmPassword}
              onChangeText={text => { setConfirmPassword(text); setFormError(''); }}
              secureTextEntry
              placeholder="Repeat new password"
              placeholderTextColor={COLORS.textMuted}
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
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.modalBtnSaveText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  name: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary },
  email: { fontSize: 13.5, color: COLORS.textSecondary, marginTop: 4 },
  list: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  rowValue: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 15,
    marginTop: SPACING.lg,
  },
  logoutText: { fontSize: 15, fontWeight: '800', color: COLORS.danger },
  note: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.lg },

  // Modal forms (edit profile / change password) — admin plain-modal style.
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: '#fafafa',
  },
  modalError: {
    fontSize: 12,
    color: COLORS.danger,
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
  modalBtnCancel: { backgroundColor: COLORS.surfaceMuted },
  modalBtnSave: { backgroundColor: COLORS.primary, minWidth: 80, alignItems: 'center' },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modalBtnSaveText: { fontSize: 14, fontWeight: '600', color: COLORS.white },
});
