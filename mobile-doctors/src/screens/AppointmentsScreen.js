import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import appointmentService from '../services/appointmentService';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { showAlert } from '../utils/alert';
import { chipColors } from '../utils/statusChip';

// ─── helpers ──────────────────────────────────────────────────────────────────
const formatDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toApiDate = d => {
  // d is a JS Date; returns YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayApiDate = () => toApiDate(new Date());

// Build an array of Date objects for the horizontal date picker (today ± 6 days)
const buildDateRange = () => {
  const days = [];
  for (let i = -1; i <= 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return -1;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return -1;
  }
  
  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E', darkText: '#FCD34D', dot: '#F59E0B' },
  booked:    { label: 'Booked',    bg: '#EFF6FF', text: '#1D4ED8', darkText: '#93C5FD', dot: '#2563EB' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#065F46', darkText: '#6EE7B7', dot: '#10B981' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', darkText: '#FCA5A5', dot: '#EF4444' },
};

const STATUS_FILTERS = ['all', 'pending', 'booked', 'completed', 'cancelled'];

const StatusBadge = ({ status }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  const chip = chipColors(cfg, isDark);
  return (
    <View style={[styles.badge, { backgroundColor: chip.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: chip.text }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── Appointment Card ──────────────────────────────────────────────────────────
const AppointmentCard = ({ item, onAccept, onComplete, onCancel, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPending = item.status === 'pending';
  const isBooked = item.status === 'booked';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => onPress(item)}>
      {/* Time Column */}
      <View style={styles.cardTimeCol}>
        <Text style={styles.cardTime}>{item.time || '—'}</Text>
        <View style={[styles.timeLine, { backgroundColor: STATUS_CONFIG[item.status]?.dot ?? colors.primary }]} />
      </View>

      {/* Main Content */}
      <View style={styles.cardBody}>
        {/* Header row */}
        <View style={styles.cardRow}>
          <View style={styles.cardAvatarWrap}>
            <MCIcon name="account-circle" size={36} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>{item.userName || 'Unknown Patient'}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>{item.consultationType || item.visit_type || 'Consultation'}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* Info pills */}
        <View style={styles.cardInfoRow}>
          <View style={styles.infoPill}>
            <MCIcon name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.infoPillText}>{formatDate(item.date)}</Text>
          </View>
          {item.endTime ? (
            <View style={styles.infoPill}>
              <MCIcon name="clock-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.infoPillText}>{item.time} – {item.endTime}</Text>
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        {(isPending || isBooked) && (
          <View style={styles.cardActions}>
            {isPending ? (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn]}
                  activeOpacity={0.85}
                  onPress={() => onAccept(item)}>
                  <MCIcon name="check-circle-outline" size={15} color={colors.white} />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  activeOpacity={0.85}
                  onPress={() => onCancel(item)}>
                  <MCIcon name="close-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.completeBtn]}
                  activeOpacity={0.85}
                  onPress={() => onComplete(item)}>
                  <MCIcon name="checkbox-marked-circle-outline" size={15} color={colors.white} />
                  <Text style={styles.completeBtnText}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  activeOpacity={0.85}
                  onPress={() => onCancel(item)}>
                  <MCIcon name="close-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Date Pill ─────────────────────────────────────────────────────────────────
const DatePill = ({ date, selected, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isToday = toApiDate(date) === todayApiDate();
  return (
    <TouchableOpacity
      style={[styles.datePill, selected && styles.datePillActive]}
      activeOpacity={0.8}
      onPress={onPress}>
      <Text style={[styles.datePillDay, selected && styles.datePillTextActive]}>
        {DAY_LABELS[date.getDay()]}
      </Text>
      <Text style={[styles.datePillNum, selected && styles.datePillTextActive]}>
        {date.getDate()}
      </Text>
      {isToday && <View style={[styles.todayDot, selected && { backgroundColor: colors.white }]} />}
    </TouchableOpacity>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ selectedDate, onClear }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={styles.emptyWrap}>
    <MCIcon name="calendar-blank-outline" size={64} color={colors.border} />
    <Text style={styles.emptyTitle}>No appointments</Text>
    <Text style={styles.emptySubtitle}>
      No appointments found{selectedDate ? ` for ${formatDate(selectedDate)}` : ''}.
    </Text>
    {selectedDate && (
      <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.85} onPress={onClear}>
        <Text style={styles.emptyBtnText}>View all dates</Text>
      </TouchableOpacity>
    )}
  </View>
  );
};

// ─── Summary Bar ───────────────────────────────────────────────────────────────
const SummaryBar = ({ appointments }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const total = appointments.length;
  const pending = appointments.filter(a => a.status === 'pending').length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  return (
    <View style={styles.summaryBar}>
      {[
        { label: 'Total', value: total, color: colors.primary },
        { label: 'Pending', value: pending, color: '#F59E0B' },
        { label: 'Completed', value: completed, color: '#10B981' },
      ].map(s => (
        <View key={s.label} style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: s.color }]}>{s.value}</Text>
          <Text style={styles.summaryLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
const AppointmentsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // null = all dates
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTime, setSelectedTime] = useState('all');
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  const dateRange = useRef(buildDateRange()).current;

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAppointments = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedStatus !== 'all') params.status = selectedStatus;

      const data = await appointmentService.getDoctorAppointments(params);
      setAppointments(data?.appointments ?? []);
    } catch (err) {
      console.warn('[AppointmentsScreen] fetch error:', err?.message);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, selectedStatus]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments(false);
  };

  // ── Status Action Helpers ───────────────────────────────────────────────────
  const updateAppointmentStatus = async (id, status) => {
    try {
      await appointmentService.updateStatus(id, status);
      await fetchAppointments(false);
    } catch (e) {
      showAlert('Error', e?.message || 'Could not update appointment status.');
    }
  };

  const handleAccept = item => {
    showAlert(
      'Accept Appointment',
      `Accept appointment for ${item.userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => updateAppointmentStatus(item.id, 'booked') },
      ],
    );
  };

  const handleComplete = item => {
    showAlert(
      'Complete Appointment',
      `Mark appointment for ${item.userName} as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: () => updateAppointmentStatus(item.id, 'completed') },
      ],
    );
  };

  const handleCancel = item => {
    showAlert(
      'Cancel Appointment',
      `Cancel appointment for ${item.userName}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => updateAppointmentStatus(item.id, 'cancelled') },
      ],
    );
  };

  // ── Card press ──────────────────────────────────────────────────────────────
  const handlePress = item => {
    navigation.navigate('PatientDetails', { userId: item.userId, appointment: item });
  };

  // ── Derived display ─────────────────────────────────────────────────────────
  const todayLabel = (() => {
    if (!selectedDate) return 'All Dates';
    const d = new Date(selectedDate + 'T00:00:00');
    const today = todayApiDate();
    if (selectedDate === today) return `Today, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  })();

  const statusLabel = selectedStatus === 'all'
    ? 'All Status'
    : STATUS_CONFIG[selectedStatus]?.label ?? selectedStatus;

  const filteredAppointments = appointments.filter(appt => {
    if (selectedTime === 'all') return true;
    const mins = parseTimeToMinutes(appt.time);
    if (mins === -1) return false;

    if (selectedTime === 'morning') {
      return mins >= 360 && mins <= 719; // 06:00 AM - 11:59 AM
    }
    if (selectedTime === 'afternoon') {
      return mins >= 720 && mins <= 1019; // 12:00 PM - 04:59 PM
    }
    if (selectedTime === 'evening') {
      return mins >= 1020 && mins <= 1319; // 05:00 PM - 09:59 PM
    }
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Appointments"
        right={
          <TouchableOpacity onPress={onRefresh}>
            <MCIcon name="refresh" size={22} color={colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Date strip */}
      <View style={styles.dateStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStripInner}>
          {/* "All" pill */}
          <TouchableOpacity
            style={[styles.datePill, !selectedDate && styles.datePillActive]}
            activeOpacity={0.8}
            onPress={() => setSelectedDate(null)}>
            <MCIcon name="calendar-blank" size={14} color={!selectedDate ? colors.white : colors.textSecondary} />
            <Text style={[styles.datePillDay, !selectedDate && styles.datePillTextActive]}>All</Text>
          </TouchableOpacity>
          {dateRange.map((d, i) => (
            <DatePill
              key={i}
              date={d}
              selected={selectedDate === toApiDate(d)}
              onPress={() => setSelectedDate(selectedDate === toApiDate(d) ? null : toApiDate(d))}
            />
          ))}
        </ScrollView>
      </View>

      {/* Filter row */}
      <View style={styles.filterRow}>
        <View style={styles.filterLeft}>
          <MCIcon name="calendar-range" size={14} color={colors.primary} />
          <Text style={styles.filterLabel}>{todayLabel}</Text>
        </View>

        {/* Status filter chip */}
        <TouchableOpacity
          style={styles.filterChip}
          activeOpacity={0.85}
          onPress={() => setShowStatusFilter(true)}>
          <MCIcon name="filter-variant" size={14} color={colors.primary} />
          <Text style={styles.filterChipText}>{statusLabel}</Text>
          <MCIcon name="chevron-down" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Time filter chips */}
      <View style={styles.timeFilterRow}>
        {['all', 'morning', 'afternoon', 'evening'].map(t => {
          const isActive = selectedTime === t;
          const label = t.charAt(0).toUpperCase() + t.slice(1);
          return (
            <TouchableOpacity
              key={t}
              style={[styles.timeChip, isActive && styles.timeChipActive]}
              activeOpacity={0.85}
              onPress={() => setSelectedTime(t)}>
              <Text style={[styles.timeChipText, isActive && styles.timeChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Summary bar */}
      {!loading && filteredAppointments.length > 0 && <SummaryBar appointments={filteredAppointments} />}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading appointments…</Text>
        </View>
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          selectedDate={selectedDate}
          onClear={() => { setSelectedDate(null); setSelectedStatus('all'); setSelectedTime('all'); }}
        />
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <AppointmentCard
              item={item}
              onAccept={handleAccept}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onPress={handlePress}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
        />
      )}

      {/* Status filter modal */}
      <Modal
        visible={showStatusFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusFilter(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusFilter(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by Status</Text>
            {STATUS_FILTERS.map(s => {
              const cfg = s === 'all' ? null : STATUS_CONFIG[s];
              const active = selectedStatus === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.modalOption, active && styles.modalOptionActive]}
                  activeOpacity={0.85}
                  onPress={() => { setSelectedStatus(s); setShowStatusFilter(false); }}>
                  {cfg ? (
                    <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
                  ) : (
                    <MCIcon name="format-list-bulleted" size={14} color={active ? colors.white : colors.textSecondary} />
                  )}
                  <Text style={[styles.modalOptionText, active && { color: colors.white }]}>
                    {cfg?.label ?? 'All Status'}
                  </Text>
                  {active && <MCIcon name="check" size={16} color={colors.white} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default AppointmentsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Date strip
  dateStrip: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  dateStripInner: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm },
  datePill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.surfaceMuted,
    minWidth: 50,
    gap: 2,
  },
  datePillActive: { backgroundColor: colors.primary },
  datePillDay: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' },
  datePillNum: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  datePillTextActive: { color: colors.white },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 2 },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Time filter row
  timeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: SPACING.sm,
  },
  timeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timeChipActive: {
    backgroundColor: colors.primaryFaint,
    borderColor: colors.primary,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timeChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 10.5, color: colors.textSecondary, fontWeight: '600', marginTop: 1 },

  // List
  list: { padding: SPACING.lg, paddingBottom: 100 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  cardTimeCol: { width: 62, alignItems: 'center', paddingTop: 14, paddingBottom: 10, gap: 6, backgroundColor: colors.primaryFaint },
  cardTime: { fontSize: 11.5, fontWeight: '800', color: colors.primary, textAlign: 'center', lineHeight: 15 },
  timeLine: { flex: 1, width: 3, borderRadius: 2, minHeight: 20 },
  cardBody: { flex: 1, padding: SPACING.md, gap: SPACING.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardAvatarWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 14.5, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  cardInfoRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  infoPillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: RADIUS.sm },
  acceptBtn: { backgroundColor: colors.primary },
  acceptBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  completeBtn: { backgroundColor: colors.success },
  completeBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  cancelBtn: { backgroundColor: colors.danger + '1A', borderWidth: 1.5, borderColor: colors.danger },
  cancelBtnText: { color: colors.danger, fontSize: 13, fontWeight: '700' },

  // Status badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Loading
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, gap: SPACING.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  emptySubtitle: { fontSize: 13.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: SPACING.sm, paddingHorizontal: SPACING.xl, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: RADIUS.pill },
  emptyBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, paddingBottom: 36, gap: SPACING.sm },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: SPACING.sm },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 13, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: colors.surfaceMuted },
  modalOptionActive: { backgroundColor: colors.primary },
  modalOptionText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
