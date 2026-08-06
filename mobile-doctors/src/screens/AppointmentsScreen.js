import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import appointmentService from '../services/appointmentService';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { showAlert } from '../utils/alert';
import { chipColors } from '../utils/statusChip';
import {
  MONTH_LONG,
  WEEK_DAYS,
  toDateKey,
  todayKey,
  keyToDate,
  addDays,
  formatDayFull,
  relativeDayLabel,
  matchesTimeSlot,
  countByDate,
  buildAgendaSections,
  buildDateSections,
  findNextAppointment,
} from '../utils/appointmentAgenda';

// ─── helpers ──────────────────────────────────────────────────────────────────
const isAppointmentOver = (dateStr, endTimeStr) => {
  if (!dateStr) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 0;
  let minutes = 0;
  if (endTimeStr) {
    const match = endTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hours < 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
    }
  }
  const apptEnd = new Date(year, month - 1, day, hours, minutes);
  return new Date() >= apptEnd;
};

/** Two weeks of quick-pick days, starting today. */
const STRIP_DAYS = 14;

// Module-level so SectionList doesn't see a fresh component type each render.
const gapStyles = StyleSheet.create({ cardGap: { height: SPACING.md } });
const CardGap = () => <View style={gapStyles.cardGap} />;

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E', darkText: '#FCD34D', dot: '#F59E0B' },
  booked:    { label: 'Booked',    bg: '#EFF6FF', text: '#1D4ED8', darkText: '#93C5FD', dot: '#2563EB' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#065F46', darkText: '#6EE7B7', dot: '#10B981' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', darkText: '#FCA5A5', dot: '#EF4444' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'booked', label: 'Booked' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

// Consultation-type filter. `consultationType` comes back as the display name
// ("Clinic Visit"), but older rows only carry the `visit_type` slug — match both.
const VISIT_FILTERS = [
  { key: 'all',    label: 'All types',    icon: 'format-list-bulleted', names: null },
  { key: 'clinic', label: 'Clinic visit', icon: 'hospital-building',    names: ['clinic visit', 'clinic'] },
  { key: 'home',   label: 'Home visit',   icon: 'home-outline',         names: ['home visit', 'home'] },
  { key: 'video',  label: 'Video call',   icon: 'video-outline',        names: ['video call', 'video'] },
];

const TIME_FILTERS = [
  { key: 'all',       label: 'Any time',   icon: 'clock-outline' },
  { key: 'morning',   label: 'Morning',    icon: 'weather-sunset-up' },
  { key: 'afternoon', label: 'Afternoon',  icon: 'weather-sunny' },
  { key: 'evening',   label: 'Evening',    icon: 'weather-night' },
];

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
const AppointmentCard = ({ item, showDate, onAccept, onComplete, onCancel, onPress }) => {
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
        {item.endTime ? (
          <Text style={styles.cardTime}>{item.endTime}</Text>
        ) : null}
      </View>

      {/* Main Content */}
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Avatar uri={item.userAvatar} name={item.userName} size={40} />
          <View style={styles.cardNameWrap}>
            <Text style={styles.cardName} numberOfLines={1}>{item.userName || 'Unknown Patient'}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>{item.consultationType || item.visit_type || 'Consultation'}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* The day header already carries the date, so a card only repeats it
            where its section mixes days (the overdue group). */}
        {showDate ? (
          <View style={styles.cardInfoRow}>
            <View style={styles.infoPill}>
              <MCIcon name="calendar-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.infoPillText}>{formatDayFull(toDateKey(item.date))}</Text>
            </View>
          </View>
        ) : null}

        {/* Action buttons */}
        {(isPending || isBooked) && (
          <View style={styles.cardActions}>
            {isPending ? (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  activeOpacity={0.85}
                  onPress={() => onCancel(item)}>
                  <MCIcon name="close-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.acceptBtn]}
                  activeOpacity={0.85}
                  onPress={() => onAccept(item)}>
                  <MCIcon name="check-circle-outline" size={15} color={colors.white} />
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  activeOpacity={0.85}
                  onPress={() => onCancel(item)}>
                  <MCIcon name="close-circle-outline" size={15} color={colors.danger} />
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                {(() => {
                  const apptOver = isAppointmentOver(toDateKey(item.date), item.endTime || item.time);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        styles.completeBtn,
                        !apptOver && styles.completeBtnOff,
                      ]}
                      disabled={!apptOver}
                      activeOpacity={0.85}
                      onPress={() => onComplete(item)}>
                      <MCIcon
                        name="checkbox-marked-circle-outline"
                        size={15}
                        color={apptOver ? colors.white : colors.textMuted}
                      />
                      <Text style={[styles.completeBtnText, !apptOver && styles.completeBtnTextOff]}>Complete</Text>
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Date strip pill ───────────────────────────────────────────────────────────
const DayPill = ({ dateKey, count, selected, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const d = keyToDate(dateKey);
  const isToday = dateKey === todayKey();
  return (
    <TouchableOpacity
      style={[styles.dayPill, isToday && styles.dayPillToday, selected && styles.dayPillOn]}
      activeOpacity={0.8}
      onPress={onPress}>
      <Text style={[styles.dayPillDow, selected && styles.dayPillTextOn]}>
        {WEEK_DAYS[d.getDay()].toUpperCase()}
      </Text>
      <Text style={[styles.dayPillNum, selected && styles.dayPillTextOn]}>{d.getDate()}</Text>
      {/* A count, not a dot: "how busy is Thursday" is the question a doctor
          actually asks of a date strip. */}
      {count > 0 ? (
        <View style={[styles.dayPillCount, selected && styles.dayPillCountOn]}>
          <Text style={[styles.dayPillCountText, selected && styles.dayPillCountTextOn]}>{count}</Text>
        </View>
      ) : (
        <View style={styles.dayPillCountSpacer} />
      )}
    </TouchableOpacity>
  );
};

// ─── Section header ────────────────────────────────────────────────────────────
const SectionHeading = ({ section, count }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const overdue = section.kind === 'overdue';
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionMark, overdue && styles.sectionMarkWarn]} />
      <View style={styles.sectionHeadText}>
        <Text style={[styles.sectionTitle, overdue && styles.sectionTitleWarn]}>{section.title}</Text>
        <Text style={styles.sectionSub}>{section.subtitle}</Text>
      </View>
      {count > 0 ? (
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
};

// ─── Empty day card ────────────────────────────────────────────────────────────
const EmptyDayCard = ({ section, hiddenCount, nextUp, onClearFilters }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isToday = section.kind === 'today';

  if (hiddenCount > 0) {
    return (
      <View style={styles.emptyDay}>
        <MCIcon name="filter-off-outline" size={22} color={colors.textMuted} />
        <Text style={styles.emptyDayTitle}>
          {hiddenCount} appointment{hiddenCount === 1 ? '' : 's'} hidden by your filters
        </Text>
        <TouchableOpacity style={styles.emptyDayBtn} activeOpacity={0.8} onPress={onClearFilters}>
          <Text style={styles.emptyDayBtnText}>Clear filters</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.emptyDay}>
      <MCIcon
        name={isToday ? 'coffee-outline' : 'calendar-blank-outline'}
        size={22}
        color={colors.textMuted}
      />
      <Text style={styles.emptyDayTitle}>
        {isToday ? 'No more appointments today' : 'Nothing scheduled'}
      </Text>
      {isToday && nextUp ? (
        <Text style={styles.emptyDaySub}>
          Next: {relativeDayLabel(nextUp.dateKey)} at {nextUp.appointment.time || '—'}
        </Text>
      ) : null}
    </View>
  );
};

// ─── Option chip (filter sheet) ────────────────────────────────────────────────
const OptionChip = ({ icon, label, dot, active, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.optChip, active && styles.optChipOn]}
      activeOpacity={0.85}
      onPress={onPress}>
      {dot ? <View style={[styles.statusDot, { backgroundColor: dot }]} /> : null}
      {icon ? <MCIcon name={icon} size={14} color={active ? colors.white : colors.textSecondary} /> : null}
      <Text style={[styles.optChipText, active && styles.optChipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
const AppointmentsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Empty = agenda mode (today + what's coming). Non-empty = only these days.
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('all');
  // Deliberately 'all' rather than the current part of the day: defaulting to
  // "evening" at 6pm silently hid the morning's appointments.
  const [selectedTime, setSelectedTime] = useState('all');
  const [selectedVisit, setSelectedVisit] = useState('all');

  const [showFilters, setShowFilters] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  const today = todayKey();
  const anchor = useRef(new Date()).current;
  const [calMonth, setCalMonth] = useState(anchor.getMonth());
  const [calYear, setCalYear] = useState(anchor.getFullYear());

  // ── Fetch ───────────────────────────────────────────────────────────────────
  // One unfiltered request: the screen needs every appointment anyway to tally
  // the per-day counts, and filtering in memory keeps the strip badges, the
  // calendar and the list from disagreeing with each other.
  const fetchAppointments = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const data = await appointmentService.getDoctorAppointments({});
      setAppointments(data?.appointments ?? []);
    } catch (err) {
      console.warn('[AppointmentsScreen] fetch error:', err?.message);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Full-screen loader on the first load only; regaining focus (e.g. coming
  // back from the detail screen after accepting) refreshes silently.
  const hasFetchedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      fetchAppointments(!hasFetchedRef.current);
      hasFetchedRef.current = true;
    }, [fetchAppointments]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchAppointments(false);
  };

  // ── Status Action Helpers ───────────────────────────────────────────────────
  const updateAppointmentStatus = async (id, status) => {
    // Optimistic: flip the card immediately, then sync with the server.
    setAppointments(prev => prev.map(a => (a.id === id ? { ...a, status } : a)));
    try {
      await appointmentService.updateStatus(id, status);
      await fetchAppointments(false);
    } catch (e) {
      await fetchAppointments(false); // roll back to server truth
      showAlert('Error', e?.message || 'Could not update appointment status.');
    }
  };

  const handleAccept = item => {
    showAlert('Accept Appointment', `Accept appointment for ${item.userName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => updateAppointmentStatus(item.id, 'booked') },
    ]);
  };

  const handleComplete = item => {
    showAlert('Complete Appointment', `Mark appointment for ${item.userName} as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => updateAppointmentStatus(item.id, 'completed') },
    ]);
  };

  const handleCancel = item => {
    showAlert('Cancel Appointment', `Cancel appointment for ${item.userName}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => updateAppointmentStatus(item.id, 'cancelled') },
    ]);
  };

  const handlePress = item => {
    navigation.navigate('AppointmentDetail', {
      appointment: item,
      onStatusUpdate: (updatedId, newStatus) => {
        setAppointments(prev =>
          prev.map(appt => (appt.id === updatedId ? { ...appt, status: newStatus } : appt)),
        );
      },
    });
  };

  // ── Filtering ───────────────────────────────────────────────────────────────
  const activeFilters = [selectedStatus, selectedVisit, selectedTime].filter(v => v !== 'all').length;

  const clearFilters = useCallback(() => {
    setSelectedStatus('all');
    setSelectedVisit('all');
    setSelectedTime('all');
  }, []);

  const filtered = useMemo(() => {
    const visit = VISIT_FILTERS.find(v => v.key === selectedVisit);
    return appointments.filter(appt => {
      if (selectedStatus !== 'all' && appt.status !== selectedStatus) return false;
      if (visit?.names) {
        const value = String(appt.consultationType || appt.visit_type || '').toLowerCase();
        if (!visit.names.includes(value)) return false;
      }
      return matchesTimeSlot(appt.time, selectedTime);
    });
  }, [appointments, selectedStatus, selectedVisit, selectedTime]);

  // Badges count what the doctor would actually see if they tapped the day, so
  // they track the active filters rather than the raw catalogue.
  const counts = useMemo(() => countByDate(filtered), [filtered]);
  const rawCounts = useMemo(() => countByDate(appointments), [appointments]);

  const sections = useMemo(
    () =>
      selectedDates.length
        ? buildDateSections(filtered, selectedDates, today)
        : buildAgendaSections(filtered, today),
    [filtered, selectedDates, today],
  );

  const visibleCount = useMemo(
    () => sections.reduce((n, s) => n + s.data.length, 0),
    [sections],
  );
  const pendingCount = useMemo(
    () => sections.reduce((n, s) => n + s.data.filter(a => a.status === 'pending').length, 0),
    [sections],
  );

  const nextUp = useMemo(() => findNextAppointment(filtered, today), [filtered, today]);

  const stripDays = useMemo(
    () => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i)),
    [today],
  );

  const toggleDate = key =>
    setSelectedDates(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key].sort(),
    );

  const scopeLabel =
    selectedDates.length === 0
      ? 'Upcoming'
      : selectedDates.length === 1
      ? relativeDayLabel(selectedDates[0], today)
      : `${selectedDates.length} days selected`;

  // ── Calendar ────────────────────────────────────────────────────────────────
  const monthOffset = (calYear - anchor.getFullYear()) * 12 + (calMonth - anchor.getMonth());
  const shiftMonth = step => {
    const next = monthOffset + step;
    // A filter, not a booking picker — a year either way covers the history a
    // doctor might scan without letting the arrows run forever.
    if (next < -12 || next > 12) return;
    const d = new Date(anchor.getFullYear(), anchor.getMonth() + next, 1);
    setCalMonth(d.getMonth());
    setCalYear(d.getFullYear());
  };

  const calendarGrid = useMemo(() => {
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const blanks = Array(new Date(calYear, calMonth, 1).getDay()).fill(null);
    return [...blanks, ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  }, [calMonth, calYear]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Appointments"
        subtitle={formatDayFull(today)}
        showBack={false}
        underColor={colors.card}
        right={
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.8}
            onPress={() => {
              const base = selectedDates.length ? keyToDate(selectedDates[0]) : new Date();
              setCalMonth(base.getMonth());
              setCalYear(base.getFullYear());
              setShowCalendar(true);
            }}>
            <MCIcon name="calendar-month-outline" size={20} color={colors.headerText} />
            {selectedDates.length > 0 ? (
              <View style={styles.headerBtnBadge}>
                <Text style={styles.headerBtnBadgeText}>{selectedDates.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        }
      />

      {/* Quick-pick day strip — two weeks out, each day showing its load. The
          calendar button above handles anything further away or multi-day. */}
      <View style={styles.strip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripInner}>
          <TouchableOpacity
            style={[styles.modePill, selectedDates.length === 0 && styles.modePillOn]}
            activeOpacity={0.8}
            onPress={() => setSelectedDates([])}>
            <Text style={[styles.modePillText, selectedDates.length === 0 && styles.modePillTextOn]}>
              Upcoming
            </Text>
          </TouchableOpacity>

          <View style={styles.stripDivider} />

          {stripDays.map(key => (
            <DayPill
              key={key}
              dateKey={key}
              count={counts[key] || 0}
              selected={selectedDates.includes(key)}
              onPress={() => toggleDate(key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Scope + filters — one line replacing the old three-chip filter row and
          the separate totals bar. */}
      <View style={styles.scopeBar}>
        <View style={styles.scopeTextWrap}>
          <Text style={styles.scopeTitle} numberOfLines={1}>{scopeLabel}</Text>
          <Text style={styles.scopeSub} numberOfLines={1}>
            {visibleCount} appointment{visibleCount === 1 ? '' : 's'}
            {pendingCount > 0 ? ` · ${pendingCount} awaiting you` : ''}
          </Text>
        </View>

        {activeFilters > 0 ? (
          <TouchableOpacity style={styles.clearBtn} activeOpacity={0.8} onPress={clearFilters}>
            <MCIcon name="close" size={14} color={colors.danger} />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.filterBtn, activeFilters > 0 && styles.filterBtnOn]}
          activeOpacity={0.85}
          onPress={() => setShowFilters(true)}>
          <MCIcon
            name="tune-variant"
            size={15}
            color={activeFilters > 0 ? colors.white : colors.primary}
          />
          <Text style={[styles.filterBtnText, activeFilters > 0 && styles.filterBtnTextOn]}>
            Filters
          </Text>
          {activeFilters > 0 ? (
            <View style={styles.filterCount}>
              <Text style={styles.filterCountText}>{activeFilters}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading appointments…</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <SectionHeading section={section} count={section.data.length} />
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <EmptyDayCard
                section={section}
                hiddenCount={
                  activeFilters > 0 && section.dateKey ? rawCounts[section.dateKey] || 0 : 0
                }
                nextUp={nextUp}
                onClearFilters={clearFilters}
              />
            ) : null
          }
          renderItem={({ item, section }) => (
            <AppointmentCard
              item={item}
              showDate={section.kind === 'overdue'}
              onAccept={handleAccept}
              onComplete={handleComplete}
              onCancel={handleCancel}
              onPress={handlePress}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ItemSeparatorComponent={CardGap}
        />
      )}

      {/* Filters sheet — status, type and time in one place, so the list header
          stays a single row instead of a wall of dropdowns. */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowFilters(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Filters</Text>
              {activeFilters > 0 ? (
                <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
                  <Text style={styles.sheetReset}>Reset all</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={styles.groupLabel}>Status</Text>
            <View style={styles.chipWrap}>
              {STATUS_FILTERS.map(opt => (
                <OptionChip
                  key={opt.key}
                  label={opt.label}
                  dot={STATUS_CONFIG[opt.key]?.dot}
                  active={selectedStatus === opt.key}
                  onPress={() => setSelectedStatus(opt.key)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>Consultation type</Text>
            <View style={styles.chipWrap}>
              {VISIT_FILTERS.map(opt => (
                <OptionChip
                  key={opt.key}
                  icon={opt.icon}
                  label={opt.label}
                  active={selectedVisit === opt.key}
                  onPress={() => setSelectedVisit(opt.key)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>Time of day</Text>
            <View style={styles.chipWrap}>
              {TIME_FILTERS.map(opt => (
                <OptionChip
                  key={opt.key}
                  icon={opt.icon}
                  label={opt.label}
                  active={selectedTime === opt.key}
                  onPress={() => setSelectedTime(opt.key)}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={() => setShowFilters(false)}>
              <Text style={styles.doneBtnText}>
                Show {visibleCount} appointment{visibleCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Calendar — multi-select, with each day's load on the cell itself. */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Pick days</Text>
              <Text style={styles.sheetHint}>Tap to add or remove</Text>
            </View>

            <View style={styles.calHead}>
              <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.calNav} activeOpacity={0.7}>
                <MCIcon name="chevron-left" size={24} color={monthOffset <= -12 ? colors.textMuted : colors.primary} />
              </TouchableOpacity>
              <Text style={styles.calMonthText}>{MONTH_LONG[calMonth]} {calYear}</Text>
              <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.calNav} activeOpacity={0.7}>
                <MCIcon name="chevron-right" size={24} color={monthOffset >= 12 ? colors.textMuted : colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEK_DAYS.map(wd => (
                <Text key={wd} style={styles.weekDay}>{wd}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {calendarGrid.map((day, idx) => {
                if (day === null) return <View key={`blank-${idx}`} style={styles.cell} />;

                const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = selectedDates.includes(key);
                const isToday = key === today;
                const count = counts[key] || 0;

                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.cell}
                    activeOpacity={0.7}
                    onPress={() => toggleDate(key)}>
                    <View
                      style={[
                        styles.cellInner,
                        count > 0 && styles.cellHasAppt,
                        isToday && styles.cellToday,
                        isSelected && styles.cellOn,
                      ]}>
                      <Text
                        style={[
                          styles.cellText,
                          isToday && !isSelected && styles.cellTextToday,
                          isSelected && styles.cellTextOn,
                        ]}>
                        {day}
                      </Text>
                      {count > 0 ? (
                        <Text style={[styles.cellCount, isSelected && styles.cellCountOn]}>{count}</Text>
                      ) : (
                        <View style={styles.cellCountSpacer} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calActions}>
              <TouchableOpacity
                style={[styles.calBtn, styles.calBtnGhost]}
                activeOpacity={0.85}
                onPress={() => setSelectedDates([])}>
                <MCIcon name="calendar-remove-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.calBtnGhostText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calBtn, styles.calBtnGhost]}
                activeOpacity={0.85}
                onPress={() => setSelectedDates([today])}>
                <MCIcon name="calendar-today" size={16} color={colors.primary} />
                <Text style={styles.calBtnTodayText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.calBtn, styles.calBtnPrimary]}
                activeOpacity={0.85}
                onPress={() => setShowCalendar(false)}>
                <Text style={styles.calBtnPrimaryText}>
                  {selectedDates.length ? `Show ${selectedDates.length} day${selectedDates.length === 1 ? '' : 's'}` : 'Done'}
                </Text>
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
const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerBtnBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnBadgeText: { fontSize: 10, fontWeight: '900', color: colors.black },

  // Day strip
  strip: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  // `stretch` so the mode pill and the divider stand as tall as the two-line
  // day boxes instead of floating as a short capsule beside them.
  stripInner: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, gap: SPACING.sm, alignItems: 'stretch' },
  stripDivider: { width: 1, marginVertical: 6, backgroundColor: colors.border },
  modePill: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  modePillOn: { backgroundColor: colors.primary },
  modePillText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  modePillTextOn: { color: colors.white },

  dayPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 46,
    gap: 1,
  },
  dayPillToday: { borderColor: colors.primary },
  dayPillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayPillDow: { fontSize: 9.5, fontWeight: '800', color: colors.textSecondary },
  dayPillNum: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  dayPillTextOn: { color: colors.white },
  dayPillCount: {
    minWidth: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
  },
  dayPillCountOn: { backgroundColor: 'rgba(255,255,255,0.28)' },
  dayPillCountText: { fontSize: 10, fontWeight: '900', color: colors.primary, textAlign: 'center' },
  dayPillCountTextOn: { color: colors.white },
  dayPillCountSpacer: { height: 14 },

  // Scope + filters
  scopeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scopeTextWrap: { flex: 1 },
  scopeTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  scopeSub: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
  clearBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  filterBtnOn: { backgroundColor: colors.primary },
  filterBtnText: { fontSize: 12.5, fontWeight: '800', color: colors.primary },
  filterBtnTextOn: { color: colors.white },
  filterCount: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { fontSize: 10.5, fontWeight: '900', color: colors.white },

  // List
  list: { padding: SPACING.lg, paddingBottom: 100, flexGrow: 1 },

  // Section headers
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  sectionMark: { width: 3, height: 26, borderRadius: 2, backgroundColor: colors.primary },
  sectionMarkWarn: { backgroundColor: colors.warning },
  sectionHeadText: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
  sectionTitleWarn: { color: colors.warning },
  sectionSub: { fontSize: 11.5, fontWeight: '600', color: colors.textSecondary, marginTop: 1 },
  sectionCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: { fontSize: 11.5, fontWeight: '900', color: colors.primary },

  // Empty day — a bounded placeholder so an empty day still reads as a day,
  // instead of the section collapsing into the one below it.
  emptyDay: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  emptyDayTitle: { fontSize: 13.5, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  emptyDaySub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  emptyDayBtn: {
    marginTop: 2,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  emptyDayBtnText: { fontSize: 12.5, fontWeight: '800', color: colors.primary },

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
  cardTimeCol: { width: 65, alignItems: 'center', paddingTop: 12, paddingBottom: 12, gap: 4, backgroundColor: colors.primaryFaint },
  cardTime: { fontSize: 11.5, fontWeight: '800', color: colors.primary, textAlign: 'center', lineHeight: 15 },
  timeLine: { flex: 1, width: 3, borderRadius: 2, minHeight: 20 },
  cardBody: { flex: 1, padding: SPACING.md, gap: SPACING.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardNameWrap: { flex: 1 },
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
  completeBtnOff: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  completeBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  completeBtnTextOff: { color: colors.textMuted },
  cancelBtn: { backgroundColor: colors.danger + '1A', borderWidth: 1.5, borderColor: colors.danger },
  cancelBtnText: { color: colors.danger, fontSize: 13, fontWeight: '700' },

  // Status badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Loading / empty
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },

  // Sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 26,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: colors.textPrimary },
  sheetHint: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  sheetReset: { fontSize: 13, fontWeight: '800', color: colors.danger },

  groupLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  optChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optChipText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  optChipTextOn: { color: colors.white },
  statusDot: { width: 9, height: 9, borderRadius: 5 },

  doneBtn: {
    marginTop: SPACING.xl,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 14.5, fontWeight: '800', color: colors.white },

  // Calendar
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  calMonthText: { fontSize: 15, fontWeight: '900', color: colors.textPrimary },
  calNav: { padding: 4 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.textMuted,
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 1/7-width cells so all seven columns line up with the weekday header on
  // every screen size.
  cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  cellInner: {
    width: 40,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellHasAppt: { backgroundColor: colors.primaryLight },
  cellToday: { borderColor: colors.primary },
  cellOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellText: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary, lineHeight: 17 },
  cellTextToday: { color: colors.primary, fontWeight: '900' },
  cellTextOn: { color: colors.white, fontWeight: '900' },
  cellCount: { fontSize: 9.5, fontWeight: '900', color: colors.primary, lineHeight: 12 },
  cellCountOn: { color: colors.white },
  cellCountSpacer: { height: 12 },

  calActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  calBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  calBtnGhost: { backgroundColor: colors.surfaceMuted },
  calBtnGhostText: { fontSize: 13, fontWeight: '800', color: colors.textSecondary },
  calBtnTodayText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  calBtnPrimary: { flex: 1, backgroundColor: colors.primary, borderColor: colors.primary },
  calBtnPrimaryText: { fontSize: 13.5, fontWeight: '800', color: colors.white },
});
