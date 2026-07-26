import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  FlatList,
  Animated,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { useLeaveStore } from '../store/useLeaveStore';
import { showSuccess, showError } from '../utils/toast';
import availabilityService from '../services/availabilityService';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_MODES = [
  { id: 'single', label: 'Single Day' },
  { id: 'multiple', label: 'Multiple Days' },
  { id: 'custom', label: 'Partial Day' },
];

const REASONS = ['Vacation', 'Medical', 'Conference', 'Personal', 'Emergency', 'Other'];

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateStr = (dStr) => {
  if (!dStr) return '— Select —';
  const d = new Date(dStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, '0')}:${m} ${ampm}`;
};

const parseTime = (timeStr) => {
  const [time, ampm] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Compare two date strings YYYY-MM-DD; returns true if a <= b
const dateNotAfter = (a, b) => {
  if (!a || !b) return true;
  return new Date(a) <= new Date(b);
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const ApplyLeaveScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const addLeave = useLeaveStore((s) => s.addLeave);

  // Loading & Submission states
  const [submitting, setSubmitting] = useState(false);
  const [allDbSlots, setAllDbSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ── Date pickers states
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [datePickerTarget, setDatePickerTarget] = useState('start'); // 'start' | 'end'

  // ── Partial Day states
  const [isPartialDay, setIsPartialDay] = useState(false);
  const [slotSelections, setSlotSelections] = useState({});
  // Currently visible day card in Partial Day mode
  const [activeDayCard, setActiveDayCard] = useState('');

  // ── Shared form states
  const [reason, setReason] = useState('Vacation');
  const [notes, setNotes] = useState('');

  // ── Modal visibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  // ── Invalid date dialogs
  const [showDateErrorDialog, setShowDateErrorDialog] = useState(false);
  const [showPastDateErrorDialog, setShowPastDateErrorDialog] = useState(false);

  // ── Calendar navigation state (shared across all pickers)
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // ── Submit button animation
  const submitBtnOpacity = useRef(new Animated.Value(0.45)).current;

  // ─── Load Slots ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadSlots = async () => {
      setLoadingSlots(true);
      try {
        const slotsData = await availabilityService.getSlots();
        setAllDbSlots(slotsData || []);
      } catch (err) {
        console.warn('Failed to load slot timings:', err);
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, []);

  // ─── Partial Day helpers ─────────────────────────────────────────────────

  // Returns array of 'YYYY-MM-DD' strings for every day in [startStr, endStr]
  const getDateRange = useCallback((startStr, endStr) => {
    if (!startStr || !endStr) return [];
    const dates = [];
    const current = new Date(startStr);
    const end = new Date(endStr);
    let limit = 0;
    while (current <= end && limit < 366) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
      limit++;
    }
    return dates;
  }, []);

  // Short label for a day card: { dayAbbr: 'Wed', dateLabel: '1 Jul' }
  const getDayCardLabel = (dateStr) => {
    const d = new Date(dateStr);
    const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MON_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      dayAbbr: DAY_ABBR[d.getDay()],
      dateLabel: `${d.getDate()} ${MON_ABBR[d.getMonth()]}`,
      fullDayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()],
      displayFull: `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]} • ${d.getDate()} ${MON_ABBR[d.getMonth()]}`,
    };
  };

  // Slots available for a given date (keyed by day-of-week name in allDbSlots)
  const getSlotsForDate = (dateStr) => {
    const { fullDayName } = getDayCardLabel(dateStr);
    const dayGroup = allDbSlots.find((d) => d.day === fullDayName);
    return dayGroup ? dayGroup.slots : [];
  };

  const partialDayDates = getDateRange(startDate, endDate);

  // Get days of week in range [startDate, endDate] inclusive (kept for any remaining references)
  const getDaysOfWeekInRange = (startStr, endStr) => {
    if (!startStr || !endStr) return [];
    const start = new Date(startStr);
    const end = new Date(endStr);
    const days = new Set();
    const current = new Date(start);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let limit = 0;
    while (current <= end && limit < 100) {
      days.add(dayNames[current.getDay()]);
      current.setDate(current.getDate() + 1);
      limit++;
    }
    return Array.from(days);
  };

  const activeDays = getDaysOfWeekInRange(startDate, endDate);
  const matchingDaysSlots = allDbSlots.filter((d) => activeDays.includes(d.day));

  // ─── Live form validation ────────────────────────────────────────────────────

  const isFormValid = useCallback(() => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) return false;

    if (!startDate || !endDate) return false;
    if (new Date(endDate) < new Date(startDate)) return false;

    if (isPartialDay) {
      const dates = getDateRange(startDate, endDate);
      const hasSlot = dates.some((dStr) => {
        const slots = slotSelections[dStr] || [];
        return slots.length > 0;
      });
      return hasSlot;
    }
    return true;
  }, [startDate, endDate, reason, isPartialDay, slotSelections, getDateRange]);

  // Animate submit button when validity changes
  useEffect(() => {
    const valid = isFormValid();
    Animated.timing(submitBtnOpacity, {
      toValue: valid ? 1 : 0.45,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isFormValid, submitBtnOpacity]);

  // Keep activeDayCard in sync with startDate/endDate when isPartialDay is active
  useEffect(() => {
    if (isPartialDay) {
      const dates = getDateRange(startDate, endDate);
      if (!activeDayCard || !dates.includes(activeDayCard)) {
        setActiveDayCard(startDate);
      }
    }
  }, [isPartialDay, startDate, endDate, getDateRange, activeDayCard]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const openDatePicker = (target) => {
    setDatePickerTarget(target);
    setShowDatePicker(true);
  };

  const handleDateSelect = (dateStr) => {
    const todayStr = getTodayStr();

    if (datePickerTarget === 'start') {
      // Guard: past date
      if (dateStr < todayStr) {
        setShowDatePicker(false);
        setShowPastDateErrorDialog(true);
        return;
      }
      setStartDate(dateStr);
      // If End Date is before Start Date, sync it to Start Date
      if (endDate && new Date(endDate) < new Date(dateStr)) {
        setEndDate(dateStr);
      }
    } else {
      // Selecting End Date – validate it is not before Start Date
      if (startDate && new Date(dateStr) < new Date(startDate)) {
        setShowDatePicker(false);
        setShowDateErrorDialog(true);
        return;
      }
      setEndDate(dateStr);
    }
    setShowDatePicker(false);
  };

  // Toggle a slot for the currently active day card
  const togglePartialSlot = (dateStr, slotId) => {
    setSlotSelections((prev) => {
      const current = prev[dateStr] || [];
      const updated = current.includes(slotId)
        ? current.filter((id) => id !== slotId)
        : [...current, slotId];
      return { ...prev, [dateStr]: updated };
    });
  };

  // Select/clear every slot on one day — ticking 8 slots one at a time across a
  // week of dates was the slowest part of applying for partial leave.
  const toggleAllSlotsForDay = (dateStr) => {
    const available = getSlotsForDate(dateStr);
    setSlotSelections((prev) => {
      const current = prev[dateStr] || [];
      const allOn = available.length > 0 && current.length === available.length;
      return { ...prev, [dateStr]: allOn ? [] : available.map((s) => s.id) };
    });
  };


  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (!startDate || !endDate) {
        showError('Please select both Start Date and End Date.');
        setSubmitting(false);
        return;
      }
      if (new Date(endDate) < new Date(startDate)) {
        showError('End Date must be on or after Start Date.');
        setSubmitting(false);
        return;
      }
      if (!isPartialDay) {
        // Full Day Leave (Single or Multiple Days)
        const isSingleDay = startDate === endDate;
        await addLeave({
          leaveType: isSingleDay ? 'single' : 'multiple',
          startDate,
          endDate,
          reason,
          notes: notes.trim(),
        });
      } else {
        // Custom (Partial Day) Leave (Single or Multiple Days)
        const dates = getDateRange(startDate, endDate);
        const allSelectedSlots = [];
        dates.forEach((dStr) => {
          const daySlots = slotSelections[dStr] || [];
          allSelectedSlots.push(...daySlots);
        });
        const uniqueSlotIds = [...new Set(allSelectedSlots)];
        if (uniqueSlotIds.length === 0) {
          showError('Please select at least one time slot.');
          setSubmitting(false);
          return;
        }
        await addLeave({
          leaveType: 'custom',
          startDate,
          endDate,
          slotTimingIds: uniqueSlotIds,
          reason,
          notes: notes.trim(),
        });
      }

      showSuccess('Leave request submitted successfully.');
      navigation.goBack();
    } catch (err) {
      showError(err.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Calendar Renderer ──────────────────────────────────────────────────────

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
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

    // Minimum selectable date depends on the picker target:
    //   single / start  → today (cannot pick past)
    //   end             → startDate if set, otherwise today
    const todayStr = getTodayStr();
    const minSelectableDate =
      datePickerTarget === 'end'
        ? (startDate || todayStr)
        : todayStr;

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.calNavBtn}>
            <MCIcon name="chevron-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.calendarMonthText}>{MONTHS[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.calNavBtn}>
            <MCIcon name="chevron-right" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={weekDaysRowStyle}>
          {WEEK_DAYS.map((wd) => (
            <Text key={wd} style={styles.weekDayText}>{wd}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {gridItems.map((day, idx) => {
            if (day === null) return <View key={`blank-${idx}`} style={styles.dayCell} />;

            const itemDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            // A date is disabled if it is strictly before the minimum selectable date
            const isDisabled = itemDateStr < minSelectableDate;

            let isSelected = false;
            let inRange = false;

            if (!isDisabled) {
              isSelected = itemDateStr === startDate || itemDateStr === endDate;
              if (startDate && endDate) {
                inRange =
                  new Date(itemDateStr) > new Date(startDate) &&
                  new Date(itemDateStr) < new Date(endDate);
              }
            }

            return (
              <TouchableOpacity
                key={`day-${day}`}
                style={[
                  styles.dayCell,
                  isDisabled && styles.dayCellDisabled,
                  inRange && styles.dayCellInRange,
                ]}
                onPress={isDisabled ? undefined : () => handleDateSelect(itemDateStr)}
                disabled={isDisabled}
                activeOpacity={isDisabled ? 1 : 0.7}
              >
                <View style={[styles.dayCircle, isSelected && styles.dayCellActive]}>
                  <Text
                    style={[
                      styles.dayText,
                      isDisabled && styles.dayTextDisabled,
                      isSelected && styles.dayTextActive,
                      inRange && styles.dayTextInRange,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ─── Shared sub-sections ─────────────────────────────────────────────────────

  const renderReasonDropdown = () => (
    <>
      <Text style={styles.label}>Reason</Text>
      <Pressable
        onPress={() => setShowReasonPicker(true)}
        style={[styles.inputContainer, showReasonPicker && styles.inputFocused]}
      >
        <MCIcon name="alert-circle-outline" size={20} color={colors.primary} style={styles.inputIcon} />
        <Text style={styles.inputText}>{reason}</Text>
        <MCIcon name="menu-down" size={24} color={colors.textMuted} />
      </Pressable>
    </>
  );

  const renderNotesInput = () => (
    <>
      <Text style={styles.label}>Notes</Text>
      <View style={[styles.inputContainer, styles.textAreaContainer]}>
        <MCIcon name="pencil-outline" size={20} color={colors.textMuted} style={[styles.inputIcon, { marginTop: 10 }]} />
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter additional leave notes..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          editable={!submitting}
        />
      </View>
    </>
  );

  const renderSubmitButton = () => {
    const valid = isFormValid();
    const isDisabled = submitting || !valid;
    return (
      <Animated.View style={{ opacity: submitBtnOpacity }}>
        <TouchableOpacity
          style={[
            styles.submitBtn,
            isDisabled && styles.submitBtnDisabled,
          ]}
          activeOpacity={valid ? 0.85 : 1}
          onPress={isDisabled ? undefined : handleSubmit}
          disabled={isDisabled}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={[styles.submitBtnText, isDisabled && styles.submitBtnTextDisabled]}>
              Submit Leave
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderDateRangeRow = () => (
    <View style={styles.dateRangeRow}>
      <View style={styles.dateRangeItem}>
        <Text style={styles.label}>Start Date</Text>
        <Pressable
          onPress={() => openDatePicker('start')}
          style={[
            styles.inputContainer,
            showDatePicker && datePickerTarget === 'start' && styles.inputFocused,
          ]}
          disabled={submitting}
        >
          <MCIcon name="calendar-start" size={20} color={colors.primary} style={styles.inputIcon} />
          <Text style={[styles.inputText, !startDate && styles.inputPlaceholder]}>
            {startDate ? formatDateStr(startDate) : 'Start Date'}
          </Text>
          <MCIcon name="menu-down" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.dateRangeItem}>
        <Text style={styles.label}>End Date</Text>
        <Pressable
          onPress={() => openDatePicker('end')}
          style={[
            styles.inputContainer,
            showDatePicker && datePickerTarget === 'end' && styles.inputFocused,
          ]}
          disabled={submitting}
        >
          <MCIcon name="calendar-end" size={20} color={colors.primary} style={styles.inputIcon} />
          <Text style={[styles.inputText, !endDate && styles.inputPlaceholder]}>
            {endDate ? formatDateStr(endDate) : 'End Date'}
          </Text>
          <MCIcon name="menu-down" size={22} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  // ─── Partial Day Section (horizontal day card strip + single-day slots) ──────

  const renderPartialDayCheckbox = () => {
    return (
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setIsPartialDay(!isPartialDay)}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <MCIcon
            name={isPartialDay ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={isPartialDay ? colors.primary : colors.textSecondary}
          />
          <Text style={styles.checkboxLabel}>
            Apply for Partial Day Leave
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPartialDaySection = () => {
    if (!isPartialDay) return null;

    if (loadingSlots) {
      return (
        <View style={styles.slotsLoader}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.slotsLoaderText}>Loading slot timings...</Text>
        </View>
      );
    }

    const currentActiveDay = activeDayCard || startDate;
    const daySlots = getSlotsForDate(currentActiveDay);
    const allDaySlotsSelected =
      daySlots.length > 0 &&
      (slotSelections[currentActiveDay] || []).length === daySlots.length;

    return (
      <View style={styles.partialDayContainer}>
        {partialDayDates.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayCardStrip}
          >
            {partialDayDates.map((dStr) => {
              const isActive = dStr === currentActiveDay;
              const { dayAbbr, dateLabel } = getDayCardLabel(dStr);
              const selectedSlots = slotSelections[dStr] || [];
              const available = getSlotsForDate(dStr);
              
              // Badge copy is kept to one short line — "3 Slots" used to wrap in
              // the 82px card, so cards in the strip ended up different heights.
              const isFull = available.length > 0 && selectedSlots.length === available.length;
              const badgeText = selectedSlots.length === 0
                ? 'None'
                : isFull ? 'All' : `${selectedSlots.length}`;
              const badgeHue = selectedSlots.length === 0
                ? colors.textMuted
                : isFull ? colors.success : colors.primary;

              return (
                <TouchableOpacity
                  key={dStr}
                  style={[styles.dayCard, isActive && styles.dayCardActive]}
                  activeOpacity={0.8}
                  onPress={() => setActiveDayCard(dStr)}
                  disabled={submitting}
                >
                  <Text style={[styles.dayCardDayText, isActive && styles.dayCardTextActive]} numberOfLines={1}>
                    {dayAbbr}
                  </Text>
                  <Text style={[styles.dayCardDateText, isActive && styles.dayCardTextActive]} numberOfLines={1}>
                    {dateLabel}
                  </Text>
                  <View style={[
                    styles.dayCardBadge,
                    { backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : `${badgeHue}22` },
                  ]}>
                    <Text
                      style={[styles.dayCardBadgeText, { color: isActive ? colors.white : badgeHue }]}
                      numberOfLines={1}
                    >
                      {badgeText}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.activeDayPanel}>
          <View style={styles.activeDayPanelHeader}>
            <MCIcon name="calendar-clock" size={16} color={colors.primary} />
            <Text style={styles.activeDayPanelTitle} numberOfLines={1}>
              {formatDateStr(currentActiveDay)}
            </Text>
            {daySlots.length > 0 && (
              <TouchableOpacity
                onPress={() => toggleAllSlotsForDay(currentActiveDay)}
                disabled={submitting}
                activeOpacity={0.7}
                hitSlop={HIT}
              >
                <Text style={styles.selectAllText}>{allDaySlotsSelected ? 'Clear' : 'Select all'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.activeDayDivider} />

          {daySlots.length === 0 ? (
            <View style={styles.noSlotsRow}>
              <MCIcon name="calendar-remove" size={20} color={colors.textMuted} />
              <Text style={styles.noSlotsText}>No slots configured for this day.</Text>
            </View>
          ) : (
            <View style={styles.slotsGrid}>
              {daySlots.map((slot) => {
                const selectedForDay = slotSelections[currentActiveDay] || [];
                const isSlotActive = selectedForDay.includes(slot.id);
                const timeLabel = `${formatTime12h(slot.start_time)} – ${formatTime12h(slot.end_time)}`;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[styles.slotCard, isSlotActive && styles.slotCardActive]}
                    activeOpacity={0.8}
                    onPress={() => togglePartialSlot(currentActiveDay, slot.id)}
                    disabled={submitting}
                  >
                    <MCIcon
                      name={isSlotActive ? 'check-circle' : 'clock-outline'}
                      size={16}
                      color={isSlotActive ? colors.white : colors.primary}
                    />
                    <Text
                      style={[styles.slotText, isSlotActive && styles.slotTextActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {timeLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderForm = () => {
    return (
      <View style={styles.formContainer}>
        {renderDateRangeRow()}
        {renderReasonDropdown()}
        {renderNotesInput()}
        {renderPartialDayCheckbox()}
        {renderPartialDaySection()}
        {renderSubmitButton()}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Apply Leave" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderForm()}
      </ScrollView>

      {/* ── MODAL: DATE PICKER ─────────────────────────────────────────── */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDatePicker(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {datePickerTarget === 'end' ? 'Select End Date' : datePickerTarget === 'start' ? 'Select Start Date' : 'Select Date'}
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <MCIcon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {renderCalendar()}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: REASON SELECTOR ─────────────────────────────────────── */}
      <Modal
        visible={showReasonPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReasonPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowReasonPicker(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Reason</Text>
              <TouchableOpacity onPress={() => setShowReasonPicker(false)}>
                <MCIcon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingVertical: SPACING.md }}>
              {REASONS.map((r) => {
                const isSelected = reason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={styles.reasonOption}
                    onPress={() => {
                      setReason(r);
                      setShowReasonPicker(false);
                    }}
                  >
                    <Text style={[styles.reasonOptionText, isSelected && styles.reasonOptionTextActive]}>
                      {r}
                    </Text>
                    {isSelected && <MCIcon name="check" size={22} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: INVALID DATE RANGE DIALOG ───────────────────────────── */}
      <Modal
        visible={showDateErrorDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateErrorDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertDialogContent}>
            <View style={styles.alertIconWrap}>
              <MCIcon name="calendar-alert" size={32} color="#D32F2F" />
            </View>
            <Text style={styles.alertDialogTitle}>Invalid Date Range</Text>
            <Text style={styles.alertDialogMessage}>
              {'End Date cannot be earlier than Start Date.\nPlease select a valid date.'}
            </Text>
            <TouchableOpacity
              style={styles.alertDialogBtn}
              activeOpacity={0.85}
              onPress={() => setShowDateErrorDialog(false)}
            >
              <Text style={styles.alertDialogBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: PAST DATE ERROR DIALOG ────────────────────────────────── */}
      <Modal
        visible={showPastDateErrorDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPastDateErrorDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertDialogContent}>
            <View style={styles.alertIconWrap}>
              <MCIcon name="calendar-remove" size={32} color="#D32F2F" />
            </View>
            <Text style={styles.alertDialogTitle}>Invalid Date</Text>
            <Text style={styles.alertDialogMessage}>
              {'You cannot apply leave for a past date.'}
            </Text>
            <TouchableOpacity
              style={styles.alertDialogBtn}
              activeOpacity={0.85}
              onPress={() => setShowPastDateErrorDialog(false)}
            >
              <Text style={styles.alertDialogBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default ApplyLeaveScreen;

// Inline style mapping for weekDaysRow because StyleSheet cannot compose dynamic arrays directly in React Native sometimes
const weekDaysRowStyle = {
  flexDirection: 'row',
  justifyContent: 'flex-start',
  marginBottom: 8,
};

const makeStyles = colors =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },

  label: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: RADIUS.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: SPACING.sm,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md - 2,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: '800',
  },

  formContainer: { marginTop: SPACING.xs },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  inputFocused: {
    borderColor: colors.primary,
    elevation: 1,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputIcon: { marginRight: SPACING.sm },
  inputText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14.5,
    fontWeight: '700',
  },
  inputPlaceholder: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.textPrimary,
    fontSize: 14.5,
    fontWeight: '600',
    paddingVertical: 0,
  },
  textAreaContainer: {
    height: 90,
    alignItems: 'flex-start',
    paddingVertical: SPACING.xs,
  },
  textArea: {
    textAlignVertical: 'top',
    height: '100%',
  },

  dateRangeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dateRangeItem: {
    flex: 1,
  },
  dateRangeSummaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  dateRangeSummaryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primary,
    flex: 1,
  },

  // ── Partial Day Styles ────────────────────────────────────────────────────
  partialDayContainer: {
    marginTop: SPACING.xs,
  },
  dayCardStrip: {
    paddingVertical: SPACING.xs,
    paddingRight: SPACING.md,
    gap: SPACING.sm,
  },
  dayCard: {
    width: 82,
    minHeight: 84,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  dayCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    elevation: 3,
    shadowOpacity: 0.18,
  },
  dayCardDayText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dayCardDateText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayCardTextActive: {
    color: colors.white,
  },
  dayCardBadge: {
    marginTop: 4,
    minWidth: 30,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  dayCardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  // Active day slots panel
  activeDayPanel: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    marginTop: SPACING.md,
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  activeDayPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  activeDayPanelTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  selectAllText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.primary,
  },
  activeDayDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: SPACING.md,
  },
  noSlotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  noSlotsText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  // Two-column slot grid. The columns used to be `width: 48.5%` with a `3%`
  // left margin on the odd ones — 48.5 + 3 + 48.5 = exactly 100%, so a single
  // rounded-up pixel wrapped the second card onto its own line and the grid
  // came out ragged. A real `gap` leaves the widths free of the gutter maths.
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 42,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  slotCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  slotTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  selectedSlotsChips: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  selectedSlotsHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  slotsCardPlaceholder: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  slotsPlaceholderText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  slotsLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  slotsLoaderText: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  submitBtnDisabled: {
    backgroundColor: '#9E9E9E',
    elevation: 0,
    shadowOpacity: 0,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: '800',
  },
  submitBtnTextDisabled: {
    color: 'rgba(255,255,255,0.75)',
  },

  // ── Invalid Date Alert Dialog ───────────────────────────────────────────────
  alertDialogContent: {
    width: '85%',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  alertIconWrap: {
    backgroundColor: '#FFF0F0',
    borderRadius: 40,
    padding: 14,
    marginBottom: SPACING.md,
  },
  alertDialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#D32F2F',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  alertDialogMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: SPACING.lg,
    fontWeight: '500',
  },
  alertDialogBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  alertDialogBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    elevation: 5,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
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
    color: colors.textMuted,
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  // Each cell is exactly 1/7 of the row so the 7 columns always fit and line up
  // with the weekday header (previously fixed 38px cells wrapped/misaligned on
  // narrower screens). The inner circle keeps the round selected-day highlight.
  dayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellActive: {
    backgroundColor: colors.primary,
  },
  dayCellInRange: {
    backgroundColor: '#D0E4FF',
    borderRadius: 0,
  },
  // Past / out-of-range dates: visually greyed out
  dayCellDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayTextActive: {
    color: colors.white,
    fontWeight: '800',
  },
  dayTextInRange: {
    color: colors.primary,
  },
  dayTextDisabled: {
    color: colors.textMuted,
  },

  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reasonOptionText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  reasonOptionTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },

  // Checkbox Styles
  checkboxContainer: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
  },
  checkboxDisabled: {
    opacity: 0.65,
  },
  checkboxLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  checkboxLabelDisabled: {
    color: colors.textMuted,
  },
  checkboxHelperText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    paddingLeft: 32,
  },
});
