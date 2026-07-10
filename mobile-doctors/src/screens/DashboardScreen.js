import React, { useCallback, useState, useMemo } from 'react';
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
import notificationsService from '../services/notificationsService';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { chipColors } from '../utils/statusChip';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E', darkText: '#FCD34D', dot: '#F59E0B' },
  booked:    { label: 'Booked',    bg: '#EFF6FF', text: '#1D4ED8', darkText: '#93C5FD', dot: '#2563EB' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#065F46', darkText: '#6EE7B7', dot: '#10B981' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', darkText: '#FCA5A5', dot: '#EF4444' },
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
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  const chip = chipColors(cfg, isDark);
  return (
    <View style={[styles.badge, { backgroundColor: chip.bg }]}>
      <Text style={[styles.badgeText, { color: chip.text }]}>{cfg.label}</Text>
    </View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(useCallback(() => {
    load(false);
    notificationsService.unreadCount().then(setUnreadCount).catch(() => {});
  }, [load]));

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
      <ScreenHeader
        title={`Hello, ${name}`}
        subtitle="Here's your day at a glance"
        showBack={false}
        right={
          <TouchableOpacity
            onPress={() => navigation.navigate('NotificationCenter')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MCIcon name="bell-outline" size={24} color={colors.white} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        >
          {/* Stats */}
          <View style={styles.statsRow}>
            {STATS.map(s => (
              <View key={s.key} style={styles.statCard}>
                <MCIcon name={s.icon} size={22} color={colors.primary} />
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
              <MCIcon name="calendar-blank-outline" size={36} color={colors.border} />
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
                  <MCIcon name={l.icon} size={24} color={colors.primary} />
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

const makeStyles = colors => StyleSheet.create({
  bellBadge: {
    position: 'absolute', top: -6, right: -6,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },

  statsRow: { flexDirection: 'row', gap: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    gap: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11.5, color: colors.textSecondary, lineHeight: 15 },

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
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  seeAll: { fontSize: 13, fontWeight: '700', color: colors.primary },

  scheduleList: { gap: SPACING.sm },
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  apptTimeCol: { width: 64, alignItems: 'center' },
  apptTime: { fontSize: 12, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  apptDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },
  apptName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  apptMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  linksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  linkCard: {
    width: '47.5%',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  linkIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
