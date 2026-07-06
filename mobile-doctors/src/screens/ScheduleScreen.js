import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import availabilityService from '../services/availabilityService';
import { useAuthStore } from '../store/authStore';
import { showSuccess, showError } from '../utils/toast';
import { useLeaveStore } from '../store/useLeaveStore';

const LEAVE_STATUS_CHIPS = {
  'Pending': { bg: '#FEF3C7', text: '#92400E' },
  'Approved': { bg: '#ECFDF5', text: '#065F46' },
  'Rejected': { bg: '#FEF2F2', text: '#991B1B' },
  'Cancelled': { bg: '#F3F4F6', text: '#4B5563' },
  'Completed': { bg: '#EFF6FF', text: '#1D4ED8' },
};

const STATUS_COLORS = {
  pending: { primary: '#2563EB', bgLight: '#FEF3C7', textDark: '#92400E' }, // primary blue, badge yellow/orange
  approved: { primary: '#10B981', bgLight: '#ECFDF5', textDark: '#065F46' }, // green
  rejected: { primary: '#EF4444', bgLight: '#FEF2F2', textDark: '#991B1B' }, // red
  cancelled: { primary: '#6B7280', bgLight: '#F3F4F6', textDark: '#4B5563' }, // grey
  all: { primary: '#7C3AED', bgLight: '#F3E8FF', textDark: '#6D28D9' }, // purple
};

const getStatusTitle = (status) => {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const getStatusLabelText = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'pending') return 'Pending Approval';
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'cancelled') return 'Cancelled';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const getLeaveCardDate = (item) => {
  const start = formatDateStr(item.start_date || item.startDate);
  const end = formatDateStr(item.end_date || item.endDate);
  if (!start) return '';
  if (!end || start === end) return start;
  return `${start} - ${end}`;
};

const getLeaveDurationText = (item) => {
  const type = item.leaveType || item.leave_type || item.type;
  const startT = item.startTime || item.start_time;
  const endT = item.endTime || item.end_time;

  if (type === 'single') {
    if (startT && endT) {
      return `${startT} - ${endT}`;
    }
    return 'Full Day';
  } else if (type === 'multiple') {
    return 'Multiple Days';
  } else if (type === 'custom') {
    if (item.slots && item.slots.length > 0) {
      return `Partial Day (${item.slots.length} Slot${item.slots.length > 1 ? 's' : ''})`;
    }
    return 'Partial Day';
  }
  return 'Full Day';
};

const getStatusLabel = (status) => {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const parseDateSafe = (dStr) => {
  if (!dStr) return new Date(0);
  if (typeof dStr !== 'string') return new Date(dStr);
  const parts = dStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dStr);
};

const formatDateStr = (dStr) => {
  if (!dStr) return '';
  const d = parseDateSafe(dStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const getFormattedDates = (item) => {
  if (item.dates) return item.dates;
  const start = formatDateStr(item.start_date || item.startDate);
  const end = formatDateStr(item.end_date || item.endDate);
  const type = item.leaveType || item.leave_type || item.type;
  const startT = item.startTime || item.start_time;
  const endT = item.endTime || item.end_time;

  if (type === 'single') {
    const timeRange = startT && endT ? ` (${startT} - ${endT})` : '';
    return `${start}${timeRange}`;
  } else if (type === 'multiple') {
    return `${start} - ${end} (Full Day)`;
  } else if (type === 'custom') {
    return `${start} - ${end}`;
  }
  return `${start} - ${end}`;
};

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
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
  const currentUser = useAuthStore(s => s.doctor);
  const rawLeaves = useLeaveStore((s) => s.leaves);
  const leaves = Array.isArray(rawLeaves) ? rawLeaves : [];
  const fetchLeaves = useLeaveStore((s) => s.fetchLeaves);
  const [selectedStatus, setSelectedStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Availability');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    leaves.forEach(l => {
      const s = (l.status || '').toLowerCase();
      if (s in counts) {
        counts[s]++;
      }
    });
    return counts;
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (selectedStatus === 'all') return true;
      return (l.status || '').toLowerCase() === selectedStatus;
    });
  }, [leaves, selectedStatus]);

  const upcomingLeavesFiltered = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = leaves.filter(l => {
      const dateStr = l.end_date || l.endDate;
      if (!dateStr) return false;
      const end = parseDateSafe(dateStr);
      return end >= now;
    });

    upcoming.sort((a, b) => {
      const aStart = parseDateSafe(a.start_date || a.startDate);
      const bStart = parseDateSafe(b.start_date || b.startDate);
      return aStart - bStart;
    });

    const filtered = upcoming.filter(l => {
      if (selectedStatus === 'all') return true;
      return (l.status || '').toLowerCase() === selectedStatus;
    });

    return filtered.slice(0, 3);
  }, [leaves, selectedStatus]);

  const hasMoreUpcomingLeaves = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = leaves.filter(l => {
      const dateStr = l.end_date || l.endDate;
      if (!dateStr) return false;
      const end = parseDateSafe(dateStr);
      return end >= now;
    });

    const filtered = upcoming.filter(l => {
      if (selectedStatus === 'all') return true;
      return (l.status || '').toLowerCase() === selectedStatus;
    });

    return filtered.length > 3;
  }, [leaves, selectedStatus]);

  const switchTab = (tab) => {
    if (tab === activeTab) return;
    fadeAnim.setValue(0);
    setActiveTab(tab);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const upcomingLeave = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = (leaves || []).filter(l => {
      const dateStr = l.endDate || l.end_date;
      if (!dateStr) return false;
      const end = parseDateSafe(dateStr);
      const statusNormalized = l.status ? l.status.toLowerCase() : '';
      return end >= now && (statusNormalized === 'pending' || statusNormalized === 'approved');
    });

    if (upcoming.length === 0) return null;

    // Sort by start date ascending
    upcoming.sort((a, b) => parseDateSafe(a.startDate || a.start_date) - parseDateSafe(b.startDate || b.start_date));
    return upcoming[0];
  }, [leaves]);

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      try {
        await fetchLeaves();
      } catch (leaveErr) {
        console.warn('[ScheduleScreen] fetchLeaves error:', leaveErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchLeaves]);

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

  const renderSegmentedControl = () => (
    <View style={styles.segmentedContainer}>
      <TouchableOpacity
        style={[
          styles.segmentButton,
          activeTab === 'Availability' && styles.segmentButtonActive,
        ]}
        onPress={() => switchTab('Availability')}
        activeOpacity={0.9}
      >
        <Text style={[
          styles.segmentText,
          activeTab === 'Availability' && styles.segmentTextActive,
        ]}>
          Availability
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.segmentButton,
          activeTab === 'Leave' && styles.segmentButtonActive,
        ]}
        onPress={() => switchTab('Leave')}
        activeOpacity={0.9}
      >
        <Text style={[
          styles.segmentText,
          activeTab === 'Leave' && styles.segmentTextActive,
        ]}>
          Leave
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderAvailabilityContent = () => {
    return (
      <Animated.View
        style={[
          styles.tabContentContainer,
          activeTab === 'Availability' ? styles.tabVisible : styles.tabHidden,
          { opacity: fadeAnim },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          <Text style={styles.sectionTitle}>Weekly Availability</Text>
          
          <View style={styles.daysListCard}>
            {WEEKDAYS.map((day, index) => {
              return (
                <View key={day}>
                  <TouchableOpacity
                    style={styles.dayRow}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('DayAvailability', { day })}
                  >
                    <Text style={styles.dayRowText}>{day}</Text>
                    <MCIcon 
                      name="chevron-right" 
                      size={20} 
                      color={COLORS.textSecondary} 
                    />
                  </TouchableOpacity>
                  {index < WEEKDAYS.length - 1 && <View style={styles.dayRowDivider} />}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Animated.View>
    );
  };

  const renderStatusIcon = (statusKey, isSelected) => {
    let iconName = 'clock-outline';
    let iconColor = STATUS_COLORS[statusKey].primary;
    let bgCircleColor = STATUS_COLORS[statusKey].bgLight;

    if (statusKey === 'pending') {
      iconName = 'clock-outline';
    } else if (statusKey === 'approved') {
      iconName = 'check-circle-outline';
    } else if (statusKey === 'rejected') {
      iconName = 'close-circle-outline';
    } else if (statusKey === 'cancelled') {
      iconName = 'minus-circle-outline';
    } else if (statusKey === 'all') {
      iconName = 'cards-outline';
    }

    if (isSelected) {
      iconColor = COLORS.white;
      bgCircleColor = 'rgba(255, 255, 255, 0.2)';
    }

    return (
      <View style={[styles.statusIconContainer, { backgroundColor: bgCircleColor }]}>
        <MCIcon name={iconName} size={18} color={iconColor} />
      </View>
    );
  };

  const renderLeaveContent = () => {
    return (
      <Animated.View
        style={[
          styles.tabContentContainer,
          activeTab === 'Leave' ? styles.tabVisible : styles.tabHidden,
          { opacity: fadeAnim },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {/* Row of Action Cards */}
          <View style={styles.actionCardsRow}>
            {/* Apply Leave Card */}
            <TouchableOpacity
              style={styles.applyLeaveRowCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ApplyLeave')}
            >
              <View style={styles.applyLeaveIconContainer}>
                <MCIcon name="calendar-plus" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.applyLeaveRowCardTitle} numberOfLines={1} ellipsizeMode="tail">
                Apply Leave
              </Text>
            </TouchableOpacity>

            {/* Leave History Card */}
            <TouchableOpacity
              style={styles.leaveHistoryRowCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('LeaveHistory', { filter: 'all' })}
            >
              <View style={[styles.applyLeaveIconContainer, { backgroundColor: '#F3E8FF' }]}>
                <MCIcon name="history" size={22} color="#7C3AED" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.upcomingHeaderRow}>
            <Text style={styles.upcomingLeavesTitle}>Upcoming Leaves</Text>
          </View>

          <View style={styles.historyList}>
            {upcomingLeavesFiltered.length > 0 ? (
              upcomingLeavesFiltered.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyCard}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('LeaveDetail', { leaveId: item.id })}
                >
                  <View style={styles.historyCardLeft}>
                    <Text style={styles.historyCardReason}>{item.reason || 'Leave'}</Text>
                    
                    <View style={styles.historyCardMetaRow}>
                      <MCIcon name="calendar-outline" size={14} color={COLORS.textSecondary} style={styles.metaIcon} />
                      <Text style={styles.historyCardMetaText}>{getLeaveCardDate(item)}</Text>
                    </View>
                    
                    <View style={styles.historyCardMetaRow}>
                      <MCIcon name="clock-outline" size={14} color={COLORS.textSecondary} style={styles.metaIcon} />
                      <Text style={styles.historyCardMetaText}>{getLeaveDurationText(item)}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.historyCardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status.toLowerCase()]?.bgLight || '#F3F4F6', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 }]}>
                      <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[item.status.toLowerCase()]?.textDark || '#4B5563', fontSize: 10, fontWeight: '800' }]}>
                        {getStatusLabelText(item.status)}
                      </Text>
                    </View>
                    <MCIcon name="chevron-right" size={20} color={COLORS.textSecondary} style={styles.chevronIcon} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              /* Empty State */
              <View style={styles.emptyStateContainer}>
                <MCIcon name="calendar-blank-outline" size={48} color={COLORS.textMuted} style={styles.emptyStateIcon} />
                <Text style={styles.emptyStateTitle}>No {getStatusTitle(selectedStatus)} Leave Requests</Text>
                <Text style={styles.emptyStateSubtitle}>Tap "Apply Leave" to create a new request.</Text>
              </View>
            )}
          </View>

          {/* See More Button */}
          {hasMoreUpcomingLeaves && (
            <TouchableOpacity
              style={styles.seeMoreBtn}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('LeaveHistory', { filter: selectedStatus })}
            >
              <Text style={styles.seeMoreBtnText}>See More</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Schedule" subtitle="Availability & Leave" />
      
      <View style={styles.segmentedWrapper}>
        {renderSegmentedControl()}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <View style={styles.mainContent}>
          {renderAvailabilityContent()}
          {renderLeaveContent()}
        </View>
      )}
    </View>
  );
};

export default ScheduleScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 100 },
  tabVisible: {
    display: 'flex',
  },
  tabHidden: {
    display: 'none',
  },
  emptyIcon: {
    marginBottom: 4,
  },
  emptyLeaveIcon: {
    marginBottom: SPACING.xs,
  },
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
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
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
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginTop: SPACING.md },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: SPACING.md,
    paddingLeft: SPACING.xs,
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // Segmented Control Styles
  segmentedWrapper: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.background,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#EEF4FF',
    borderRadius: RADIUS.md,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md - 2,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.white,
    fontWeight: '800',
  },

  // Layout Styles
  mainContent: {
    flex: 1,
  },
  tabContentContainer: {
    flex: 1,
  },

  // Weekdays List Card Styles
  daysListCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  dayRowText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  dayRowExpanded: {
    borderBottomWidth: 0,
  },
  expandedSlotsContainer: {
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  emptyDaySlots: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  emptyDaySlotsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  slotCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.sm,
    marginBottom: 8,
  },
  dayRowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Add Availability Button Styles
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

  // Leave Styles
  upcomingLeaveCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  upcomingLeaveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  upcomingLeaveType: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  upcomingLeaveDates: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  emptyLeaveCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  emptyLeaveText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  leaveActionsCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  leaveActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  leaveRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  leaveRowIcon: {
    width: 24,
    textAlign: 'center',
  },
  leaveRowText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // New Redesigned Leave Tab Styles
  actionCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  applyLeaveRowCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '67%',
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  leaveHistoryRowCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30%',
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  applyLeaveRowCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  applyLeaveCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  applyLeaveCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  applyLeaveIconContainer: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyLeaveCardTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  leaveHistoryTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  statusCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    paddingHorizontal: 2,
  },
  statusCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 2,
    minHeight: 96,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusCardSelected: {
    // Dynamic styles applied in component
  },
  statusCardTitle: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
    textAlign: 'center',
  },
  statusCardCount: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  upcomingLeavesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  viewAllText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  seeMoreBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  seeMoreBtnText: {
    color: COLORS.primary,
    fontSize: 14.5,
    fontWeight: '800',
  },
  historyList: {
    gap: SPACING.md,
  },
  historyCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyCardLeft: {
    flex: 1,
    gap: 4,
  },
  historyCardReason: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  historyCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaIcon: {
    width: 16,
    textAlign: 'center',
  },
  historyCardMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  historyCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  chevronIcon: {
    marginLeft: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  emptyStateContainer: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    gap: 8,
  },
  emptyStateIcon: {
    marginBottom: 4,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
});
