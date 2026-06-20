import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const STATS = [
  { key: 'today', label: "Today's appointments", value: '—', icon: 'calendar-today' },
  { key: 'pending', label: 'Pending requests', value: '—', icon: 'clock-alert-outline' },
  { key: 'patients', label: 'Active patients', value: '—', icon: 'account-group-outline' },
];

const QUICK_LINKS = [
  { key: 'Appointments', label: 'Appointments', icon: 'calendar-check', tab: 'Appointments' },
  { key: 'Schedule', label: 'My schedule', icon: 'calendar-clock', tab: 'Schedule' },
  { key: 'Patients', label: 'Patients', icon: 'account-multiple', tab: 'Patients' },
  { key: 'Profile', label: 'Profile', icon: 'account-circle', tab: 'Profile' },
];

const DashboardScreen = ({ navigation }) => {
  const doctor = useAuthStore(s => s.doctor);
  const name = doctor?.full_name || doctor?.name || 'Doctor';

  return (
    <View style={styles.root}>
      <ScreenHeader title={`Hello, ${name}`} subtitle="Here's your day at a glance" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map(s => (
            <View key={s.key} style={styles.statCard}>
              <MCIcon name={s.icon} size={22} color={COLORS.primary} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick links */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.linksGrid}>
          {QUICK_LINKS.map(l => (
            <TouchableOpacity
              key={l.key}
              style={styles.linkCard}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(l.tab)}>
              <View style={styles.linkIcon}>
                <MCIcon name={l.icon} size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.linkLabel}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.banner}>
          <MCIcon name="information-outline" size={18} color={COLORS.primary} />
          <Text style={styles.bannerText}>
            This is a scaffolded skeleton. Stats and lists wire up to the shared
            backend during feature development.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg },
  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 15 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  linksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  linkCard: {
    width: '47.5%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  linkIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  banner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryFaint,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.xl,
  },
  bannerText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 18 },
});
