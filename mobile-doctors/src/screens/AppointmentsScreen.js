import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import appointmentService from '../services/appointmentService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

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
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  booked:    { label: 'Booked',    bg: '#EFF6FF', text: '#1D4ED8', dot: '#2563EB' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

const STATUS_FILTERS = ['all', 'pending', 'booked', 'completed', 'cancelled'];

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── Appointment Card ──────────────────────────────────────────────────────────
const AppointmentCard = ({ item, onAccept, onComplete, onCancel, onPress }) => {
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
        <View style={[styles.timeLine, { backgroundColor: STATUS_CONFIG[item.status]?.dot ?? COLORS.primary }]} />
      </View>

      {/* Main Content */}
      <View style={styles.cardBody}>
        {/* Header row */}
        <View style={styles.cardRow}>
          <View style={styles.cardAvatarWrap}>
            <MCIcon name="account-circle" size={36} color={COLORS.primary} />
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
            <MCIcon name="calendar-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.infoPillText}>{formatDate(item.date)}</Text>
          </View>
          {item.endTime ? (
            <View style={styles.infoPill}>
              <MCIcon name="clock-outline" size={12} color={COLORS.textSecondary} />
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
                  <MCIcon name="check-circle-outline" size={15} color={COLORS.white} />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  activeOpacity={0.85}
                  onPress={() => onCancel(item)}>
                  <MCIcon name="close-circle-outline" size={15} color={COLORS.danger} />
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.completeBtn]}
                  activeOpacity={0.85}
                  onPress={() => onComplete(item)}>
                  <MCIcon name="checkbox-marked-circle-outline" size={15} color={COLORS.white} />
                  <Text style={styles.completeBtnText}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  activeOpacity={0.85}
                  onPress={() => onCancel(item)}>
                  <MCIcon name="close-circle-outline" size={15} color={COLORS.danger} />
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
      {isToday && <View style={[styles.todayDot, selected && { backgroundColor: COLORS.white }]} />}
    </TouchableOpacity>
  );
};

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ selectedDate, onClear }) => (
  <View style={styles.emptyWrap}>
    <MCIcon name="calendar-blank-outline" size={64} color={COLORS.border} />
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

// ─── Summary Bar ───────────────────────────────────────────────────────────────
const SummaryBar = ({ appointments }) => {
  const total = appointments.length;
  const pending = appointments.filter(a => a.status === 'pending').length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  return (
    <View style={styles.summaryBar}>
      {[
        { label: 'Total', value: total, color: COLORS.primary },
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
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // null = all dates
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTime, setSelectedTime] = useState('all');
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Calendar states
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const today = useRef(new Date()).current;
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [allAppointmentDates, setAllAppointmentDates] = useState(new Set());

  const fetchAllAppointmentDates = useCallback(async () => {
    try {
      const data = await appointmentService.getDoctorAppointments({});
      const appointmentsList = data?.appointments ?? [];
      const dates = new Set(
        appointmentsList
          .filter(a => a.date)
          .map(a => typeof a.date === 'string' ? a.date.split('T')[0] : toApiDate(new Date(a.date)))
      );
      setAllAppointmentDates(dates);
    } catch (err) {
      console.warn('[AppointmentsScreen] fetchAllAppointmentDates error:', err?.message);
    }
  }, []);

  const maxDate = useRef((() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d;
  })()).current;

  const isDateSelectable = (dateStr) => {
    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);
    const maxDateZero = new Date();
    maxDateZero.setMonth(maxDateZero.getMonth() + 1);
    maxDateZero.setHours(23, 59, 59, 999);
    
    const target = new Date(dateStr + 'T00:00:00');
    return target >= todayZero && target <= maxDateZero;
  };

  const handlePrevMonth = () => {
    if (currentYear > today.getFullYear() || (currentYear === today.getFullYear() && currentMonth > today.getMonth())) {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(y => y - 1);
      } else {
        setCurrentMonth(m => m - 1);
      }
    }
  };

  const handleNextMonth = () => {
    if (currentYear < maxDate.getFullYear() || (currentYear === maxDate.getFullYear() && currentMonth < maxDate.getMonth())) {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(y => y + 1);
      } else {
        setCurrentMonth(m => m + 1);
      }
    }
  };

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

  useEffect(() => {
    fetchAppointments();
    fetchAllAppointmentDates();
  }, [fetchAppointments, fetchAllAppointmentDates]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments(false);
    fetchAllAppointmentDates();
  };

  // ── Status Action Helpers ───────────────────────────────────────────────────
  const updateAppointmentStatus = async (id, status) => {
    try {
      await appointmentService.updateStatus(id, status);
      await fetchAppointments(false);
      await fetchAllAppointmentDates();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not update appointment status.');
    }
  };

  const handleAccept = item => {
    Alert.alert(
      'Accept Appointment',
      `Accept appointment for ${item.userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => updateAppointmentStatus(item.id, 'booked') },
      ],
    );
  };

  const handleComplete = item => {
    Alert.alert(
      'Complete Appointment',
      `Mark appointment for ${item.userName} as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: () => updateAppointmentStatus(item.id, 'completed') },
      ],
    );
  };

  const handleCancel = item => {
    Alert.alert(
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
    navigation.navigate('AppointmentDetail', {
      appointment: item,
    });
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

  // ─── Calendar Renderer ──────────────────────────────────────────────────────
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr);
    setShowCalendarModal(false);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear);
    const blanks = Array(firstDayIndex).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const gridItems = [...blanks, ...days];

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn}>
            <MCIcon name="chevron-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.calendarMonthText}>{MONTHS[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn}>
            <MCIcon name="chevron-right" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.weekDaysRow}>
          {WEEK_DAYS.map((wd) => (
            <Text key={wd} style={styles.weekDayText}>{wd}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {gridItems.map((day, idx) => {
            if (day === null) return <View key={`blank-${idx}`} style={styles.dayCell} />;

            const itemDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isDisabled = !isDateSelectable(itemDateStr);
            const isSelected = selectedDate === itemDateStr;
            const isToday = itemDateStr === todayApiDate();
            const hasAppt = allAppointmentDates.has(itemDateStr);

            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[
                  styles.dayCell,
                  isDisabled && styles.dayCellDisabled,
                  isToday && styles.dayCellToday,
                  isSelected && styles.dayCellActive,
                ]}
                onPress={isDisabled ? undefined : () => handleDateSelect(itemDateStr)}
                disabled={isDisabled}
                activeOpacity={isDisabled ? 1 : 0.7}
              >
                <View style={styles.dayCellContent}>
                  <Text
                    style={[
                      styles.dayText,
                      isDisabled && styles.dayTextDisabled,
                      isSelected && styles.dayTextActive,
                      isToday && !isSelected && styles.dayTextTodayText,
                    ]}
                  >
                    {day}
                  </Text>
                  {hasAppt ? (
                    <View style={[
                      styles.apptDot,
                      isSelected && styles.apptDotActive
                    ]} />
                  ) : (
                    <View style={styles.apptDotPlaceholder} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Appointments"
        right={
          <TouchableOpacity onPress={onRefresh}>
            <MCIcon name="refresh" size={22} color={COLORS.white} />
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
            <MCIcon name="calendar-blank" size={14} color={!selectedDate ? COLORS.white : COLORS.textSecondary} />
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
        <TouchableOpacity
          style={styles.filterLeft}
          activeOpacity={0.7}
          onPress={() => {
            const baseDate = selectedDate ? new Date(selectedDate + 'T00:00:00') : new Date();
            setCurrentMonth(baseDate.getMonth());
            setCurrentYear(baseDate.getFullYear());
            setShowCalendarModal(true);
          }}>
          <MCIcon name="calendar-range" size={14} color={COLORS.primary} />
          <Text style={styles.filterLabel}>{todayLabel}</Text>
        </TouchableOpacity>

        {/* Status filter chip */}
        <TouchableOpacity
          style={styles.filterChip}
          activeOpacity={0.85}
          onPress={() => setShowStatusFilter(true)}>
          <MCIcon name="filter-variant" size={14} color={COLORS.primary} />
          <Text style={styles.filterChipText}>{statusLabel}</Text>
          <MCIcon name="chevron-down" size={14} color={COLORS.primary} />
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
          <ActivityIndicator size="large" color={COLORS.primary} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
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
                    <MCIcon name="format-list-bulleted" size={14} color={active ? COLORS.white : COLORS.textSecondary} />
                  )}
                  <Text style={[styles.modalOptionText, active && { color: COLORS.white }]}>
                    {cfg?.label ?? 'All Status'}
                  </Text>
                  {active && <MCIcon name="check" size={16} color={COLORS.white} style={{ marginLeft: 'auto' }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Calendar date picker modal */}
      <Modal
        visible={showCalendarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendarModal(false)}>
        <TouchableOpacity
          style={styles.calModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCalendarModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.calModalContent}>
            <View style={styles.calModalHeader}>
              <Text style={styles.calModalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setShowCalendarModal(false)}>
                <MCIcon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {renderCalendar()}

            {/* Reset Buttons */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.todayBtn]}
                onPress={() => {
                  const todayStr = todayApiDate();
                  setSelectedDate(todayStr);
                  setShowCalendarModal(false);
                }}>
                <MCIcon name="calendar-today" size={16} color={COLORS.primary} />
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, styles.clearBtn]}
                onPress={() => {
                  setSelectedDate(null);
                  setShowCalendarModal(false);
                }}>
                <MCIcon name="calendar-remove" size={16} color={COLORS.danger} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default AppointmentsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Date strip
  dateStrip: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dateStripInner: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm },
  datePill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceMuted,
    minWidth: 50,
    gap: 2,
  },
  datePillActive: { backgroundColor: COLORS.primary },
  datePillDay: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase' },
  datePillNum: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  datePillTextActive: { color: COLORS.white },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 2 },

  // Filter row
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  // Time filter row
  timeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  timeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  timeChipActive: {
    backgroundColor: COLORS.primaryFaint,
    borderColor: COLORS.primary,
  },
  timeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  timeChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 10.5, color: COLORS.textSecondary, fontWeight: '600', marginTop: 1 },

  // List
  list: { padding: SPACING.lg, paddingBottom: 100 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  cardTimeCol: { width: 62, alignItems: 'center', paddingTop: 14, paddingBottom: 10, gap: 6, backgroundColor: COLORS.primaryFaint },
  cardTime: { fontSize: 11.5, fontWeight: '800', color: COLORS.primary, textAlign: 'center', lineHeight: 15 },
  timeLine: { flex: 1, width: 3, borderRadius: 2, minHeight: 20 },
  cardBody: { flex: 1, padding: SPACING.md, gap: SPACING.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardAvatarWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 14.5, fontWeight: '800', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  cardInfoRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  infoPillText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: RADIUS.sm },
  acceptBtn: { backgroundColor: COLORS.primary },
  acceptBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  completeBtn: { backgroundColor: COLORS.success },
  completeBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  cancelBtn: { backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: COLORS.danger },
  cancelBtnText: { color: '#991B1B', fontSize: 13, fontWeight: '700' },

  // Status badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Loading
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },

  // Empty
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, gap: SPACING.md },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: SPACING.sm, paddingHorizontal: SPACING.xl, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.xl, paddingBottom: 36, gap: SPACING.sm },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  modalOption: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 13, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceMuted },
  modalOptionActive: { backgroundColor: COLORS.primary },
  modalOptionText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  // Calendar Styles
  calModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  calModalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    elevation: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  calModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
  },
  calModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  calendarContainer: { paddingVertical: SPACING.xs },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  calendarMonthText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  calNavBtn: { padding: 4 },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    width: 32,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayCellActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayCellToday: {
    borderColor: COLORS.primary,
  },
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayCellContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  dayTextActive: {
    color: COLORS.white,
    fontWeight: '800',
  },
  dayTextTodayText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  dayTextDisabled: {
    color: COLORS.textMuted,
  },
  apptDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginTop: 1,
  },
  apptDotActive: {
    backgroundColor: COLORS.white,
  },
  apptDotPlaceholder: {
    width: 4,
    height: 4,
    backgroundColor: 'transparent',
    marginTop: 1,
  },

  // Reset Actions Row
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    gap: 6,
  },
  todayBtn: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },
  todayBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  clearBtn: {
    borderColor: COLORS.danger,
    backgroundColor: '#FEF2F2',
  },
  clearBtnText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
  },
});
