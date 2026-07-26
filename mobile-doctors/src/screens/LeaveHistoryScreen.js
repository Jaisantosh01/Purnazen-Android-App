import React, { useCallback, useState, useMemo } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { useLeaveStore } from '../store/useLeaveStore';

// One accent hue per status; the chip/badge fill is a translucent wash of it
// (`soft()`), so both light and dark themes stay legible. The old table baked in
// pale hex fills with dark text, which turned to mud in dark mode.
const STATUS_META = {
  all:       { hue: '#7C3AED', label: 'All',       icon: 'cards-outline' },
  pending:   { hue: '#F59E0B', label: 'Pending',   icon: 'clock-outline' },
  approved:  { hue: '#10B981', label: 'Approved',  icon: 'check-circle-outline' },
  rejected:  { hue: '#EF4444', label: 'Rejected',  icon: 'close-circle-outline' },
  cancelled: { hue: '#6B7280', label: 'Cancelled', icon: 'minus-circle-outline' },
};
const STATUS_KEYS = ['all', 'pending', 'approved', 'rejected', 'cancelled'];
const soft = hex => `${hex}22`;
const statusMeta = status => STATUS_META[String(status || '').toLowerCase()] || STATUS_META.pending;

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

// ─── Screen ───────────────────────────────────────────────────────────────────

const LeaveHistoryScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const leaves = useLeaveStore((s) => s.leaves);
  const loading = useLeaveStore((s) => s.loading);
  const error = useLeaveStore((s) => s.error);
  const fetchLeaves = useLeaveStore((s) => s.fetchLeaves);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const routeFilter = route?.params?.filter || route?.params?.initialFilter || 'all';
  const [selectedStatus, setSelectedStatus] = useState(routeFilter.toLowerCase());

  // Refetch every time the screen regains focus (e.g. after applying or
  // cancelling a leave) so the list is never stale.
  useFocusEffect(
    useCallback(() => {
      fetchLeaves();
    }, [fetchLeaves]),
  );

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
    const result = (leaves || []).filter(l => {
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

    // Default sort by Newest Applied First
    return [...result].sort((a, b) => {
      const dateA = new Date(a.appliedAt || a.applied_at || 0);
      const dateB = new Date(b.appliedAt || b.applied_at || 0);
      return dateB - dateA;
    });
  }, [leaves, selectedStatus, searchQuery]);

  const renderItem = ({ item }) => {
    const sDateText = getStatusDateText(item);
    const appliedAt = item.appliedAt || item.applied_at;
    const meta = statusMeta(item.status);

    return (
      <TouchableOpacity
        style={styles.historyCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('LeaveDetail', { leaveId: item.id })}
      >
        {/* Status stripe — reads the state of the row at a glance without the
            badge having to compete with the reason for space. */}
        <View style={[styles.statusStripe, { backgroundColor: meta.hue }]} />

        <View style={styles.historyCardBody}>
          <View style={styles.historyCardHeader}>
            <Text style={styles.historyCardReason} numberOfLines={1}>{item.reason || 'Leave'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: soft(meta.hue) }]}>
              <Text style={[styles.statusBadgeText, { color: meta.hue }]}>
                {getStatusLabelText(item.status)}
              </Text>
            </View>
          </View>

          <View style={styles.historyCardMetaRow}>
            <MCIcon name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.historyCardMetaText} numberOfLines={1}>{getLeaveCardDate(item)}</Text>
          </View>

          <View style={styles.historyCardMetaRow}>
            <MCIcon name="clock-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.historyCardMetaText} numberOfLines={1}>{getLeaveDurationText(item)}</Text>
          </View>

          {(appliedAt || sDateText) ? (
            <View style={styles.historyCardFooter}>
              {appliedAt ? (
                <Text style={styles.historyCardAppliedText} numberOfLines={1}>
                  Applied {formatDateTimeStr(appliedAt)}
                </Text>
              ) : null}
              {sDateText ? (
                <Text style={styles.historyCardDecisionText} numberOfLines={1}>{sDateText}</Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <MCIcon name="chevron-right" size={20} color={colors.borderStrong} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader 
        title="Leave History" 
        onBack={() => navigation.goBack()} 
      />

      {loading && leaves.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && leaves.length === 0 ? (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchLeaves}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.container}>
          {/* Status filter — five 96px-tall tiles used to be crammed edge-to-edge
              into one fixed row, so "Cancelled" wrapped and the counts collided.
              Now a scrollable chip row: label + count, readable at any width. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.statusChipScroll}
            contentContainerStyle={styles.statusChipRow}
          >
            {STATUS_KEYS.map((statusKey) => {
              const isSelected = selectedStatus === statusKey;
              const count = statusKey === 'all' ? leaves.length : (statusCounts[statusKey] || 0);
              const meta = STATUS_META[statusKey];

              return (
                <TouchableOpacity
                  key={statusKey}
                  style={[
                    styles.statusChip,
                    { borderColor: isSelected ? meta.hue : colors.border },
                    isSelected && { backgroundColor: meta.hue },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedStatus(statusKey)}
                >
                  <MCIcon name={meta.icon} size={15} color={isSelected ? colors.white : meta.hue} />
                  <Text style={[styles.statusChipLabel, { color: isSelected ? colors.white : colors.textPrimary }]}>
                    {meta.label}
                  </Text>
                  <View style={[styles.statusChipCount, { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : soft(meta.hue) }]}>
                    <Text style={[styles.statusChipCountText, { color: isSelected ? colors.white : meta.hue }]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search Bar Row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <MCIcon name="magnify" size={20} color={colors.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search leave reason"
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Filtered History List */}
          <FlatList
            data={filteredLeaves}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              <View style={styles.emptyStateContainer}>
                <MCIcon name="calendar-blank-outline" size={48} color={colors.textMuted} style={styles.emptyStateIcon} />
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

const makeStyles = colors =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  errorText: { fontSize: 14.5, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: SPACING.xl },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.md },
  retryBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  // A horizontal ScrollView in a flex column stretches to the leftover height
  // unless it's told not to, which is what padded the chip row out with dead
  // space above and below it.
  statusChipScroll: { flexGrow: 0, flexShrink: 0 },
  statusChipRow: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    backgroundColor: colors.card,
  },
  statusChipLabel: { fontSize: 12.5, fontWeight: '700' },
  statusChipCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
  },
  statusChipCountText: { fontSize: 11, fontWeight: '800' },

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
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: SPACING.md,
    height: 44,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.textPrimary,
    fontWeight: '600',
    paddingVertical: 0,
  },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    paddingRight: SPACING.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusStripe: { width: 4, alignSelf: 'stretch' },
  historyCardBody: {
    flex: 1,
    minWidth: 0,
    padding: SPACING.md,
    gap: 5,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  historyCardReason: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  historyCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyCardMetaText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  historyCardFooter: {
    marginTop: 3,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  historyCardAppliedText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textMuted,
  },
  historyCardDecisionText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});
