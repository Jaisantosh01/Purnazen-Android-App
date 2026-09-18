import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import appointmentService from '../services/appointmentService';
import notificationsService from '../services/notificationsService';
import TabHeader from '../components/TabHeader';
import EmptyState from '../components/EmptyState';
import { CardSkeleton } from '../components/SkeletonLoader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { chipColors } from '../utils/statusChip';
import { reliefCardColors, blend } from '../utils/cardTheme';

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

// Tinted 2-up tiles, same treatment as the patient app's Relief/Wellness grids.
const QUICK_LINKS = [
  { key: 'Appointments', label: 'Appointments',     sub: 'Requests & today', icon: 'calendar-check',              tab: 'Appointments', hue: '#2563EB' },
  { key: 'Schedule',     label: 'My schedule',      sub: 'Availability & leave', icon: 'calendar-clock',          tab: 'Schedule',     hue: '#0D9488' },
  { key: 'Patients',     label: 'Patients',         sub: 'Records & history', icon: 'account-multiple',           tab: 'Patients',     hue: '#7C3AED' },
  { key: 'Feedback',     label: 'Patient feedback', sub: 'Ratings & comments', icon: 'message-reply-text-outline', screen: 'FeedbackReview', hue: '#D97706' },
];

const greeting = h => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

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
  const { colors, isDark } = useTheme();
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
    { key: 'today',    label: 'Today',    value: todays.length, icon: 'calendar-today',        tab: 'Appointments' },
    { key: 'pending',  label: 'Pending',  value: pendingCount,  icon: 'clock-alert-outline',   tab: 'Appointments' },
    { key: 'patients', label: 'Patients', value: patientCount,  icon: 'account-group-outline', tab: 'Patients' },
  ];

  const openAppointment = item =>
    navigation.navigate('Appointments', {
      screen: 'AppointmentDetail',
      params: { appointment: item },
    });


  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        <TabHeader
          title={`${greeting(new Date().getHours())}, ${name}`}
          subtitle={todayLabel()}
          right={
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate('NotificationCenter')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Notifications"
            >
              <MCIcon name="bell-outline" size={22} color={colors.white} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          }
        >
          {/* Stats strip — each number is tappable and lands on the list it counts. */}
          <View style={styles.statsRow}>
            {STATS.map((s, i) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.statBox, i < STATS.length - 1 && styles.statBorder]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate(s.tab)}
              >
                <MCIcon name={s.icon} size={20} color={colors.white} />
                <Text style={styles.statValue}>{loading ? '·' : s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TabHeader>

        <View style={styles.body}>
          {/* Today's schedule */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's schedule</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Appointments')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            [1, 2].map(i => <CardSkeleton key={i} />)
          ) : todays.length === 0 ? (
            <View style={styles.emptyCard}>
              <EmptyState
                compact
                icon="calendar-blank-outline"
                title="Nothing scheduled today"
                hint="New bookings and requests appear here as they come in."
              />
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
                  <View style={inline.flex1}>
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
            {QUICK_LINKS.map(l => {
              const c = reliefCardColors({ bg: blend(l.hue, colors.card, 0.12), fg: l.hue, colors, isDark });
              return (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.linkCard, { backgroundColor: c.background }]}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate(l.screen || l.tab)}>
                  <View style={[styles.linkIcon, { backgroundColor: blend(l.hue, c.background, 0.14) }]}>
                    <MCIcon name={l.icon} size={22} color={c.accent} />
                  </View>
                  <Text style={[styles.linkLabel, { color: c.title }]}>{l.label}</Text>
                  <Text style={[styles.linkSub, { color: c.subtitle }]} numberOfLines={1}>{l.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default DashboardScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 100 },
  body: { paddingHorizontal: SPACING.lg },

  bellBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Stats strip inside the hero — fixed white-on-brand like the patient app.
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  statBox:    { flex: 1, alignItems: 'center', gap: 2 },
  statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' },
  statValue:  { fontSize: 20, fontWeight: '800', color: colors.white, fontVariant: ['tabular-nums'] },
  statLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

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
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },

  linksGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  linkCard: {
    width: '47.5%',
    borderRadius: 18,
    padding: SPACING.lg,
    gap: 2,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  linkLabel: { fontSize: 14.5, fontWeight: '800' },
  linkSub: { fontSize: 12 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});

// Literal-only styles that used to sit inline in the JSX.
const inline = StyleSheet.create({
  flex1: { flex: 1 },
});
