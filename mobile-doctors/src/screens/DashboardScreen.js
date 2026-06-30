import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import appointmentService from '../services/appointmentService';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  booked:    { label: 'Booked',    bg: '#EFF6FF', text: '#1D4ED8', dot: '#2563EB' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

const isToday = value => {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
};

// Sort by start time ("hh:mm AM/PM") so the day reads top-to-bottom.
const timeToMinutes = t => {
  if (!t) return 1e9;
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 1e9;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
};

const QUICK_LINKS = [
  { key: 'Appointments', label: 'Appointments', icon: 'calendar-check', tab: 'Appointments' },
  { key: 'Schedule', label: 'My schedule', icon: 'calendar-clock', tab: 'Schedule' },
  { key: 'Patients', label: 'Patients', icon: 'account-multiple', tab: 'Patients' },
  { key: 'Profile', label: 'Profile', icon: 'account-circle', tab: 'Profile' },
];

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const doctor = useAuthStore(s => s.doctor);
  const name = doctor?.full_name || doctor?.name || 'Doctor';

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await appointmentService.getDoctorAppointments();
      setAppointments(data?.appointments ?? []);
    } catch (err) {
      console.warn('[Dashboard] fetch error:', err?.message);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh whenever the tab regains focus so status changes made on the
  // Appointments tab show here without a manual pull.
  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(false); };

  const todays = appointments
    .filter(a => isToday(a.date) && a.status !== 'cancelled')
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const patientCount = new Set(
    appointments.filter(a => a.status !== 'cancelled').map(a => a.userId),
  ).size;

  const STATS = [
    { key: 'today',    label: "Today's appointments", value: todays.length, icon: 'calendar-today' },
    { key: 'pending',  label: 'Pending requests',     value: pendingCount,  icon: 'clock-alert-outline' },
    { key: 'patients', label: 'Active patients',      value: patientCount,  icon: 'account-group-outline' },
  ];

  const openAppointment = item =>
    navigation.navigate('Appointments', {
      screen: 'AppointmentDetail',
      params: { appointment: item },
    });


  return (
    <View style={styles.root}>
      <ScreenHeader title={`Hello, ${name}`} subtitle="Here's your day at a glance" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
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

          {/* Today's schedule */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's schedule</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Appointments')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {todays.length === 0 ? (
            <View style={styles.emptyCard}>
              <MCIcon name="calendar-blank-outline" size={36} color={COLORS.border} />
              <Text style={styles.emptyText}>No appointments scheduled for today.</Text>
            </View>
          ) : (
            <View style={styles.scheduleList}>
              {todays.map(item => (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.apptRow}
                  activeOpacity={0.85}
                  onPress={() => openAppointment(item)}
                >
                  <View style={styles.apptTimeCol}>
                    <Text style={styles.apptTime}>{item.time || '—'}</Text>
                  </View>
                  <View style={styles.apptDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.apptName} numberOfLines={1}>{item.userName || 'Unknown Patient'}</Text>
                    <Text style={styles.apptMeta} numberOfLines={1}>
                      {item.consultationType || item.visit_type || 'Consultation'}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </TouchableOpacity>
              ))}
            </View>
          )}

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
        </ScrollView>
      )}
    </View>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },

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

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  seeAll: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  scheduleList: { gap: SPACING.sm },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  apptTimeCol: { width: 64, alignItems: 'center' },
  apptTime: { fontSize: 12, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  apptDivider: { width: 1, alignSelf: 'stretch', backgroundColor: COLORS.border },
  apptName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  apptMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },

  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

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

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
