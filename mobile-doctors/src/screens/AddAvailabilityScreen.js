import React, { useState, useEffect } from 'react';
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
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import availabilityService from '../services/availabilityService';
import { useAuthStore } from '../store/authStore';
import { showSuccess, showError } from '../utils/toast';

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
  const { mode = 'create', availabilityId, currentSlotTimingId, day: editDay } = route.params || {};

  const currentUser = useAuthStore(s => s.doctor);
  const [doctorId, setDoctorId] = useState(null);
  const [selectedDay, setSelectedDay] = useState(editDay || 'Monday');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allSlotsByDay, setAllSlotsByDay] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]); // Array of slot_timing_id
  const [existingAvailabilities, setExistingAvailabilities] = useState([]); // All doctor availabilities

  // 1. Resolve Doctor ID and Fetch Data
  useEffect(() => {
    const init = async () => {
  setLoading(true);

  try {

    console.log("========== INIT START ==========");

    console.log("STEP 1 - Loading Doctors");

    const doctors = await availabilityService.getDoctors();

    console.log("Doctors Loaded:", doctors);

    console.log("STEP 2 - Finding Logged-in Doctor");

    const matchedDoctor = doctors.find(d => {
      const cleanD = cleanName(d.name);
      const cleanUser = cleanName(currentUser?.full_name || currentUser?.name);
      return cleanD === cleanUser || d.name.toLowerCase().includes(cleanUser);
    });

    console.log("Matched Doctor:", matchedDoctor);

    if (!matchedDoctor) {
      showError("Doctor profile not found.");
      return;
    }

    setDoctorId(matchedDoctor.id);

    console.log("STEP 3 - Loading Slot Timings");

    const slotData = await availabilityService.getSlots();

    console.log("Slot Timings:", slotData);

    setAllSlotsByDay(slotData);

    console.log("STEP 4 - Loading Doctor Availability");

    const availList = await availabilityService.list();

    console.log("Availability:", availList);

    const docAvails = availList.filter(
      a =>
        a.doctor_id === matchedDoctor.id &&
        a.is_active !== false
    );

    console.log("Doctor Availability:", docAvails);

    setExistingAvailabilities(docAvails);

    if (mode === "edit" && currentSlotTimingId) {
      setSelectedSlots([currentSlotTimingId]);
    }

    console.log("========== INIT FINISHED ==========");

  } catch (err) {

    console.log("========== ERROR ==========");
    console.log(err);

    showError("Failed to load availability options.");

  } finally {

    setLoading(false);

  }
};

    init();
  }, [currentUser, currentSlotTimingId, mode, navigation]);

  // Find slot timings for selected day
  const daySlotsData = allSlotsByDay.find(
    item => item.day.toLowerCase() === selectedDay.toLowerCase()
  );
  const availableSlots = daySlotsData ? [...daySlotsData.slots].sort((a, b) => a.start_time.localeCompare(b.start_time)) : [];

  // Identify slot IDs that are already active for this doctor on the selected day (excluding currentSlotTimingId if editing)
  const activeSlotIdsOnDay = existingAvailabilities
    .filter(a => {
      // Find the slot timing to see if it's on the selectedDay
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

  // Toggle slot selection
  const handleToggleSlot = (slotId) => {
    if (activeSlotIdsOnDay.includes(slotId)) {
      // Already active, prevent duplicate add
      return;
    }

    if (mode === 'edit') {
      // In edit mode, only one slot can be selected
      setSelectedSlots([slotId]);
    } else {
      // In create mode, toggle multi-select
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
        // Edit mode: update existing DoctorAvailability record
        const slotTimingId = selectedSlots[0];
        await availabilityService.update(availabilityId, { slot_timing_id: slotTimingId });
        showSuccess('Availability updated successfully.');
      } else {
        // Create mode: batch create availability records
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
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.staticDayContainer}>
            <Text style={styles.staticDayText}>{selectedDay}</Text>
          </View>

          <Text style={styles.sectionTitle}>Available Slot Timings</Text>

          {availableSlots.length === 0 ? (
            <View style={styles.emptyWrap}>
              <MCIcon name="clock-outline" size={48} color={COLORS.textMuted} />
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
                              ? COLORS.success
                              : isChecked
                              ? COLORS.primary
                              : COLORS.textMuted
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
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <MCIcon name="content-save-outline" size={20} color={COLORS.white} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex1: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: SPACING.lg },
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  dayPillTextActive: {
    color: COLORS.white,
  },
  staticDayContainer: {
    backgroundColor: '#EEF4FF',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  staticDayText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotsScroll: { flexGrow: 1, paddingBottom: SPACING.xl },
  slotsGrid: { gap: SPACING.md },
  slotCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotCardChecked: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },
  slotCardDisabled: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
    opacity: 0.75,
  },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  slotTimeText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  slotTimeTextChecked: { color: COLORS.primary },
  slotTimeTextDisabled: { color: COLORS.textSecondary },
  activeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.success },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  footer: { marginTop: 'auto', paddingTop: SPACING.md },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
