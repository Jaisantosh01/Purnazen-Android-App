import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import authService from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { showError } from '../utils/toast';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const ROWS = [
  { key: 'edit', label: 'Edit profile', icon: 'account-edit-outline' },
  { key: 'password', label: 'Change password', icon: 'lock-reset' },
  { key: 'clinic', label: 'Clinic & specialties', icon: 'hospital-building' },
  { key: 'help', label: 'Help & support', icon: 'lifebuoy' },
];

const ProfileScreen = () => {
  const doctor = useAuthStore(s => s.doctor);
  const [loggingOut, setLoggingOut] = useState(false);

  const name = doctor?.full_name || doctor?.name || 'Doctor';
  const email = doctor?.email || '';

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
          {ROWS.map(r => (
            <TouchableOpacity key={r.key} style={styles.row} activeOpacity={0.7}>
              <MCIcon name={r.icon} size={22} color={COLORS.textSecondary} />
              <Text style={styles.rowLabel}>{r.label}</Text>
              <MCIcon name="chevron-right" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
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

        <Text style={styles.note}>Profile editing rows are scaffolded placeholders.</Text>
      </ScrollView>
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
  rowLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
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
});
