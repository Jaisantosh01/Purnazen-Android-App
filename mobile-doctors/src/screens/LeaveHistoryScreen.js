import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
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

const formatDateStr = (dStr) => {
  if (!dStr) return '';
  const d = new Date(dStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, '0')}:${m} ${ampm}`;
};

const formatDateTimeStr = (dtStr) => {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const displayHours = String(hours).padStart(2, '0');
  
  return `${day} ${month} ${year}, ${displayHours}:${minutes} ${ampm}`;
};

const getStatusDateText = (item) => {
  const s = (item.status || '').toLowerCase();
  const approvedAt = item.approvedAt || item.approved_at;
  const updatedAt = item.updatedAt || item.updated_at || approvedAt;

  if (s === 'approved' && approvedAt) {
    return `Approved on: ${formatDateTimeStr(approvedAt)}`;
  } else if (s === 'rejected' && approvedAt) {
    return `Rejected on: ${formatDateTimeStr(approvedAt)}`;
  } else if (s === 'cancelled' && updatedAt) {
    return `Cancelled on: ${formatDateTimeStr(updatedAt)}`;
  }
  return null;
};

const getLeaveCardDate = (item) => {
  const start = formatDateStr(item.start_date || item.startDate || item.leaveDate);
  const end = formatDateStr(item.end_date || item.endDate || item.leaveDate);
  if (!start) return '';
  if (!end || start === end) return start;
  return `${start} - ${end}`;
};

const getLeaveDurationText = (item) => {
  const type = item.leaveType || item.leave_type || item.type;
  const startT = item.startTime || item.start_time;
  const endT = item.endTime || item.end_time;
  const start = formatDateStr(item.start_date || item.startDate || item.leaveDate);
  const end = formatDateStr(item.end_date || item.endDate || item.leaveDate);
  const dateRange = (!start || start === end) ? start : `${start} - ${end}`;

  if (type === 'single') {
    if (startT && endT) {
      return `${dateRange} ${formatTime(startT)} - ${formatTime(endT)}`;
    }
    return dateRange || 'Full Day';
  } else if (type === 'multiple') {
    return dateRange || 'Multiple Days';
  } else if (type === 'custom') {
    const slotCount = item.slots?.length || 0;
    return `${dateRange} (${slotCount} Slot${slotCount !== 1 ? 's' : ''})`;
  }
  return dateRange || 'Full Day';
};

const StatusBadge = ({ status }) => {
  const label = getStatusLabel(status);
  const cfg = STATUS_CHIP_CONFIG[label] || STATUS_CHIP_CONFIG.Pending;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{label}</Text>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const LeaveHistoryScreen = ({ route, navigation }) => {
  const leaves = useLeaveStore((s) => s.leaves);
  const loading = useLeaveStore((s) => s.loading);
  const error = useLeaveStore((s) => s.error);
  const fetchLeaves = useLeaveStore((s) => s.fetchLeaves);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const routeFilter = route?.params?.filter || route?.params?.initialFilter || 'all';
  const [selectedStatus, setSelectedStatus] = useState(routeFilter.toLowerCase());

  useEffect(() => {
    fetchLeaves();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaves();
    setRefreshing(false);
  };

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    (leaves || []).forEach(l => {
      const s = (l.status || '').toLowerCase();
      if (s in counts) {
        counts[s]++;
      }
    });
    return counts;
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    return (leaves || []).filter(l => {
      // 1. Status Filter
      const matchStatus = selectedStatus === 'all' || (l.status || '').toLowerCase() === selectedStatus;
      if (!matchStatus) return false;

      // 2. Search Filter (by reason / type / notes)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const reasonMatch = (l.reason || '').toLowerCase().includes(query);
        const notesMatch = (l.notes || '').toLowerCase().includes(query);
        const typeMatch = (l.leave_type || '').toLowerCase().includes(query);
        return reasonMatch || notesMatch || typeMatch;
      }

      return true;
    });
  }, [leaves, selectedStatus, searchQuery]);

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

  const renderItem = ({ item }) => {
    const sDateText = getStatusDateText(item);
    const appliedAt = item.appliedAt || item.applied_at;

    return (
      <TouchableOpacity
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

          {appliedAt ? (
            <Text style={styles.historyCardAppliedText}>
              Applied on: {formatDateTimeStr(appliedAt)}
            </Text>
          ) : null}

          {sDateText ? (
            <Text style={styles.historyCardDecisionText}>
              {sDateText}
            </Text>
          ) : null}
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
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader 
        title="Leave History" 
        onBack={() => navigation.goBack()} 
        right={
          <TouchableOpacity activeOpacity={0.7}>
            <MCIcon name="filter-variant" size={24} color={COLORS.white} />
          </TouchableOpacity>
        }
      />

      {loading && leaves.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && leaves.length === 0 ? (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchLeaves}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.container}>
          {/* Status Summary Cards Row (Fixed Row, Fits One Row) */}
          <View style={styles.statusCardsRow}>
            {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((statusKey) => {
              const isSelected = selectedStatus === statusKey;
              const count = statusKey === 'all' ? leaves.length : (statusCounts[statusKey] || 0);
              const title = getStatusTitle(statusKey);
              const colorCfg = STATUS_COLORS[statusKey];

              return (
                <TouchableOpacity
                  key={statusKey}
                  style={[
                    styles.statusCard,
                    isSelected && { backgroundColor: colorCfg.primary, borderColor: colorCfg.primary }
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedStatus(statusKey)}
                >
                  {renderStatusIcon(statusKey, isSelected)}
                  <Text
                    style={[
                      styles.statusCardTitle,
                      { color: isSelected ? COLORS.white : colorCfg.primary }
                    ]}
                  >
                    {title}
                  </Text>
                  <Text
                    style={[
                      styles.statusCardCount,
                      { color: isSelected ? COLORS.white : colorCfg.primary }
                    ]}
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Bar & Filter Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <MCIcon name="magnify" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search leave reason"
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
              <MCIcon name="tune" size={18} color={COLORS.primary} />
              <Text style={styles.filterBtnText}>Filter</Text>
            </TouchableOpacity>
          </View>

          {/* Filtered History List */}
          <FlatList
            data={filteredLeaves}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
            }
            ListEmptyComponent={
              <View style={styles.emptyStateContainer}>
                <MCIcon name="calendar-blank-outline" size={48} color={COLORS.textMuted} style={styles.emptyStateIcon} />
                <Text style={styles.emptyStateTitle}>No {getStatusTitle(selectedStatus)} Leave Requests</Text>
                <Text style={styles.emptyStateSubtitle}>Tap "Apply Leave" to create a new request.</Text>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
};

export default LeaveHistoryScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  errorText: { fontSize: 14.5, color: COLORS.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.xl },
  retryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.md },
  retryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },

  statusCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md - 2,
    marginBottom: SPACING.xs,
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

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.textPrimary,
    fontWeight: '600',
    paddingVertical: 0,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    height: 44,
    gap: 6,
  },
  filterBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
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
  historyCardAppliedText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 4,
  },
  historyCardDecisionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textMuted,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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
    paddingHorizontal: SPACING.xl,
  },
});
