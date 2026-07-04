import React, { useState, useCallback, useMemo } from 'react';
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
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import availabilityService from '../services/availabilityService';
import { useAuthStore } from '../store/authStore';
import { showSuccess, showError } from '../utils/toast';
import useTheme from '../hooks/useTheme';
import { showAlert } from '../utils/alert';

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
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

const ScheduleScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const currentUser = useAuthStore(s => s.doctor);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupedAvailability, setGroupedAvailability] = useState({});

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      // 1. Fetch doctors to match currentUser
      const doctors = await availabilityService.getDoctors();
      const matchedDoctor = doctors.find(d => {
        const cleanD = cleanName(d.name);
        const cleanUser = cleanName(currentUser?.full_name || currentUser?.name);
        return cleanD === cleanUser || d.name.toLowerCase().includes(cleanUser);
      });

      if (!matchedDoctor) {
        setGroupedAvailability({});
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

      // 4. Group availabilities by day
      const grouped = {};
      filteredAvails.forEach(a => {
        const slot = slotMap[a.slot_timing_id];
        if (slot) {
          const dayName = slot.day;
          if (!grouped[dayName]) {
            grouped[dayName] = [];
          }
          grouped[dayName].push({
            id: a.id,
            slot_timing_id: a.slot_timing_id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            day: dayName,
          });
        }
      });

      // 5. Sort slots within each day chronologically
      Object.keys(grouped).forEach(dayName => {
        grouped[dayName].sort((a, b) => a.start_time.localeCompare(b.start_time));
      });

      setGroupedAvailability(grouped);
    } catch (err) {
      console.warn('[ScheduleScreen] fetch error:', err);
      showError('Failed to load schedule.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [fetchData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  const handleDelete = (availabilityId, timeLabel, dayLabel) => {
    showAlert(
      'Delete Availability',
      `Are you sure you want to remove the slot ${timeLabel} on ${dayLabel}?`,
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
              console.warn('[ScheduleScreen] delete error:', err);
              showError('Error deleting availability.');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (item) => {
    navigation.navigate('AddAvailability', {
      mode: 'edit',
      availabilityId: item.id,
      currentSlotTimingId: item.slot_timing_id,
      day: item.day,
    });
  };

  // Sort days based on DAY_ORDER
  const sortedDays = Object.keys(groupedAvailability).sort((a, b) => {
    return DAY_ORDER.indexOf(a.toLowerCase()) - DAY_ORDER.indexOf(b.toLowerCase());
  });

  const renderContent = () => {
    if (sortedDays.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={styles.scrollEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          <MCIcon name="calendar-clock" size={64} color={colors.border} />
          <Text style={styles.emptyTitle}>Set Your Availability</Text>
          <Text style={styles.emptyText}>
            You haven't defined any bookable weekly slots yet. Tap the button below to add your slot availability.
          </Text>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {sortedDays.map(dayName => {
          const daySlots = groupedAvailability[dayName];
          return (
            <View key={dayName} style={styles.dayGroup}>
              <Text style={styles.dayHeader}>{dayName.toUpperCase()}</Text>
              <View style={styles.cardsContainer}>
                {daySlots.map(item => {
                  const timeLabel = `${formatTime(item.start_time)} - ${formatTime(item.end_time)}`;
                  return (
                    <View key={item.id} style={styles.slotCard}>
                      <View style={styles.slotInfo}>
                        <MCIcon name="clock-outline" size={18} color={colors.primary} />
                        <Text style={styles.slotTimeText}>{timeLabel}</Text>
                      </View>
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          activeOpacity={0.7}
                          onPress={() => handleEdit(item)}
                        >
                          <MCIcon name="pencil-outline" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          activeOpacity={0.7}
                          onPress={() => handleDelete(item.id, timeLabel, dayName)}
                        >
                          <MCIcon name="delete-outline" size={18} color={colors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Schedule" subtitle="Weekly Availability" />

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {renderContent()}
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AddAvailability', { mode: 'create' })}
          >
            <MCIcon name="plus" size={20} color={colors.white} />
            <Text style={styles.fabText}>Add Availability</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default ScheduleScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  scrollEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dayGroup: { marginBottom: SPACING.lg },
  dayHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.xs,
  },
  cardsContainer: { gap: SPACING.sm },
  slotCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  slotTimeText: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { padding: 6 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: SPACING.md },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  fabText: { color: colors.white, fontSize: 14.5, fontWeight: '800' },
});
