import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import availabilityService from '../services/availabilityService';
import { useAuthStore } from '../store/authStore';
import { showSuccess, showError } from '../utils/toast';
import useTheme from '../hooks/useTheme';

const DAYS = [
  { label: 'Monday', number: 1 },
  { label: 'Tuesday', number: 2 },
  { label: 'Wednesday', number: 3 },
  { label: 'Thursday', number: 4 },
  { label: 'Friday', number: 5 },
  { label: 'Saturday', number: 6 },
  { label: 'Sunday', number: 0 },
];

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, '0')}:${m} ${ampm}`;
};

const cleanName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(dr\b\.?|dr\b)\s*/gi, '')
    .replace(/^(dr\b\.?|dr\b)\s*/gi, '')
    .trim();
};

const AddAvailabilityScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { mode = 'create', availabilityId, currentSlotTimingId, day: editDay } = route.params || {};

  const currentUser = useAuthStore(s => s.doctor);
  const [doctorId, setDoctorId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(editDay || 'Monday');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allSlotsByDay, setAllSlotsByDay] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [existingAvailabilities, setExistingAvailabilities] = useState([]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const doctors = await availabilityService.getDoctors();
        const matchedDoctor = doctors.find(d => {
          const cleanD = cleanName(d.name);
          const cleanUser = cleanName(currentUser?.full_name || currentUser?.name);
          return cleanD === cleanUser || d.name.toLowerCase().includes(cleanUser);
        });

        if (!matchedDoctor) {
          showError("Doctor profile not found.");
          return;
        }

        setDoctorId(matchedDoctor.id);

        const slotData = await availabilityService.getSlots();
        setAllSlotsByDay(slotData);

        const availList = await availabilityService.list();
        const docAvails = availList.filter(
          a =>
            a.doctor_id === matchedDoctor.id &&
            a.is_active !== false
        );
        setExistingAvailabilities(docAvails);

        if (mode === "edit" && currentSlotTimingId) {
          setSelectedSlots([currentSlotTimingId]);
        }
      } catch (err) {
        console.warn('[AddAvailability] init error:', err);
        showError("Failed to load availability options.");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [currentUser, currentSlotTimingId, mode, navigation]);

  const daySlotsData = allSlotsByDay.find(
    item => item.day.toLowerCase() === selectedDay.toLowerCase()
  );
  const availableSlots = daySlotsData ? [...daySlotsData.slots].sort((a, b) => a.start_time.localeCompare(b.start_time)) : [];

  const activeSlotIdsOnDay = existingAvailabilities
    .filter(a => {
      const stId = a.slot_timing_id;
      const isSameDay = allSlotsByDay.some(
        dGroup => dGroup.day.toLowerCase() === selectedDay.toLowerCase() &&
                  dGroup.slots.some(s => s.id === stId)
      );
      if (mode === 'edit') {
        return isSameDay && stId !== currentSlotTimingId;
      }
      return isSameDay;
    })
    .map(a => a.slot_timing_id);

  const handleToggleSlot = (slotId) => {
    if (activeSlotIdsOnDay.includes(slotId)) {
      return;
    }

    if (mode === 'edit') {
      setSelectedSlots([slotId]);
    } else {
      if (selectedSlots.includes(slotId)) {
        setSelectedSlots(selectedSlots.filter(id => id !== slotId));
      } else {
        setSelectedSlots([...selectedSlots, slotId]);
      }
    }
  };

  const handleSave = async () => {
    if (!doctorId) {
      showError('Doctor ID not resolved.');
      return;
    }

    if (selectedSlots.length === 0) {
      showError('Please select at least one slot timing.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'edit') {
        const slotTimingId = selectedSlots[0];
        await availabilityService.update(availabilityId, { slot_timing_id: slotTimingId });
        showSuccess('Availability updated successfully.');
      } else {
        const promises = selectedSlots.map(slotTimingId =>
          availabilityService.create({
            doctor_id: doctorId,
            slot_timing_id: slotTimingId,
          })
        );
        await Promise.all(promises);
        showSuccess('Availability added successfully.');
      }
      navigation.goBack();
    } catch (err) {
      console.warn('[AddAvailability] Save error:', err);
      showError('Failed to save availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={mode === 'edit' ? 'Edit Availability' : 'Add Availability'}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.staticDayContainer}>
            <Text style={styles.staticDayText}>{selectedDay}</Text>
          </View>

          <Text style={styles.sectionTitle}>Available Slot Timings</Text>

          {availableSlots.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MCIcon name="clock-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No slot timings configured for {selectedDay}.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.slotsScroll} style={styles.flex1}>
              <View style={styles.slotsGrid}>
                {availableSlots.map(slot => {
                  const isChecked = selectedSlots.includes(slot.id);
                  const isActiveForMe = activeSlotIdsOnDay.includes(slot.id);
                  const isSelectable = !isActiveForMe;

                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[
                        styles.slotCard,
                        isChecked && styles.slotCardChecked,
                        !isSelectable && styles.slotCardDisabled,
                      ]}
                      activeOpacity={isSelectable ? 0.8 : 1}
                      onPress={() => isSelectable && handleToggleSlot(slot.id)}
                    >
                      <View style={styles.slotRow}>
                        <MCIcon
                          name={
                            isActiveForMe
                              ? 'check-circle'
                              : mode === 'edit'
                              ? isChecked
                                ? 'radiobox-marked'
                                : 'radiobox-blank'
                              : isChecked
                              ? 'checkbox-marked'
                              : 'checkbox-blank-outline'
                          }
                          size={20}
                          color={
                            isActiveForMe
                              ? colors.success
                              : isChecked
                              ? colors.primary
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.slotTimeText,
                            isChecked && styles.slotTimeTextChecked,
                            !isSelectable && styles.slotTimeTextDisabled,
                          ]}
                        >
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </Text>
                      </View>
                      {isActiveForMe && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || selectedSlots.length === 0) && styles.saveBtnDisabled,
              ]}
              disabled={saving || selectedSlots.length === 0}
              activeOpacity={0.85}
              onPress={handleSave}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <MCIcon name="content-save-outline" size={20} color={colors.white} />
                  <Text style={styles.saveBtnText}>
                    {mode === 'edit' ? 'Update Availability' : 'Save Availability'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default AddAvailabilityScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: SPACING.lg },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  dayScroll: { gap: SPACING.sm, paddingRight: SPACING.xl },
  dayPill: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dayPillTextActive: {
    color: colors.white,
  },
  staticDayContainer: {
    backgroundColor: colors.primaryLight,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  staticDayText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotsScroll: { flexGrow: 1, paddingBottom: SPACING.xl },
  slotsGrid: { gap: SPACING.md },
  slotCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotCardChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
  },
  slotCardDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.75,
  },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  slotTimeText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  slotTimeTextChecked: { color: colors.primary },
  slotTimeTextDisabled: { color: colors.textSecondary },
  activeBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '800', color: colors.success },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: { marginTop: 'auto', paddingTop: SPACING.md },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
