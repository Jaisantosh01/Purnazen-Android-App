import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { useFocusEffect } from '@react-navigation/native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import availabilityService from '../services/availabilityService';
import { useAuthStore } from '../store/authStore';
import { showSuccess, showError } from '../utils/toast';

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

const DayAvailabilityScreen = ({ route, navigation }) => {
  const { day = 'Monday' } = route.params || {};
  const currentUser = useAuthStore(s => s.doctor);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [daySlots, setDaySlots] = useState([]);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      // 1. Fetch doctors to match currentUser
      const doctors = await availabilityService.getDoctors();
      const cleanUser = cleanName(currentUser?.full_name || currentUser?.name);
      const matchedDoctor = doctors.find(d => {
        const cleanD = cleanName(d.name);
        return cleanD === cleanUser || d.name.toLowerCase().includes(cleanUser);
      });

      if (!matchedDoctor) {
        setDaySlots([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const doctorId = matchedDoctor.id;

      // 2. Fetch all slot timings and build a lookup map
      const slotData = await availabilityService.getSlots();
      const slotMap = {};
      slotData.forEach(dayGroup => {
        dayGroup.slots.forEach(slot => {
          slotMap[slot.id] = {
            id: slot.id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            day: dayGroup.day,
          };
        });
      });

      // 3. Fetch doctor availabilities and filter by doctorId
      const availList = await availabilityService.list();
      const filteredAvails = availList.filter(
        a => a.doctor_id === doctorId && a.is_active !== false
      );

      // 4. Map the availabilities that are on the selected day
      const slotsForDay = [];
      filteredAvails.forEach(a => {
        const slot = slotMap[a.slot_timing_id];
        if (slot && slot.day.toLowerCase() === day.toLowerCase()) {
          slotsForDay.push({
            id: a.id,
            slot_timing_id: a.slot_timing_id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            day: slot.day,
          });
        }
      });

      // Sort slots by start_time ascending
      slotsForDay.sort((a, b) => a.start_time.localeCompare(b.start_time));
      setDaySlots(slotsForDay);
    } catch (err) {
      console.warn('[DayAvailabilityScreen] fetch error:', err);
      showError('Failed to load availability.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, day]);

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const handleEdit = (item) => {
    navigation.navigate('AddAvailability', {
      mode: 'edit',
      availabilityId: item.id,
      currentSlotTimingId: item.slot_timing_id,
      day: item.day,
    });
  };

  const handleDelete = (availabilityId, timeLabel) => {
    showAlert(
      'Delete Availability',
      `Are you sure you want to remove the slot ${timeLabel} on ${day}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const success = await availabilityService.remove(availabilityId);
              if (success) {
                showSuccess('Availability removed successfully.');
                fetchData(false);
              } else {
                showError('Could not delete availability.');
              }
            } catch (err) {
              console.warn('[DayAvailabilityScreen] delete error:', err);
              showError('Error deleting availability.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${day} Availability`}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          <Text style={styles.sectionTitle}>Working Time Slots</Text>

          {daySlots.length === 0 ? (
            <View style={styles.emptyAvailabilityCard}>
              <MCIcon name="calendar-blank-outline" size={36} color={COLORS.border} style={styles.emptyIcon} />
              <Text style={styles.emptyAvailabilityTitle}>No availability configured for {day}.</Text>
              <Text style={styles.emptyAvailabilityText}>
                Tap the button below to add bookable weekly slots.
              </Text>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {daySlots.map(item => {
                const timeLabel = `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`;
                return (
                  <View key={item.id} style={styles.slotCard}>
                    <View style={styles.slotInfo}>
                      <MCIcon name="clock-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.slotTimeText}>{timeLabel}</Text>
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        activeOpacity={0.7}
                        onPress={() => handleEdit(item)}
                      >
                        <MCIcon name="pencil-outline" size={16} color={COLORS.textSecondary} />
                        <Text style={styles.actionText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        activeOpacity={0.7}
                        onPress={() => handleDelete(item.id, timeLabel)}
                      >
                        <MCIcon name="delete-outline" size={16} color={COLORS.danger} />
                        <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('AddAvailability', { mode: 'create', day })}
          >
            <MCIcon name="plus" size={22} color={COLORS.white} />
            <Text style={styles.addBtnText}>Add Availability</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
    paddingLeft: SPACING.xs,
  },
  cardsContainer: { gap: SPACING.sm },
  slotCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  slotTimeText: { fontSize: 14.5, fontWeight: '700', color: COLORS.textPrimary },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  emptyAvailabilityCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  emptyAvailabilityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptyAvailabilityText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyIcon: {
    marginBottom: 4,
  },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  addBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
});

export default DayAvailabilityScreen;
