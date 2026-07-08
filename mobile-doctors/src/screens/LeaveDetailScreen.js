import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { useLeaveStore } from '../store/useLeaveStore';
import { showSuccess, showError } from '../utils/toast';
import leaveService from '../services/leaveService';
import availabilityService from '../services/availabilityService';

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  Pending:   { bg: '#FEF3C7', text: '#92400E', icon: 'clock-outline' },
  Approved:  { bg: '#ECFDF5', text: '#065F46', icon: 'check-circle-outline' },
  Rejected:  { bg: '#FEF2F2', text: '#991B1B', icon: 'close-circle-outline' },
  Cancelled: { bg: '#F3F4F6', text: '#4B5563', icon: 'minus-circle-outline' },
  Completed: { bg: '#EFF6FF', text: '#1D4ED8', icon: 'calendar-check-outline' },
};

const getStatusLabel = (status) => {
  if (!status) return 'Pending';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (dStr) => {
  if (!dStr) return '—';
  const d = new Date(dStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatDateTime = (dtStr) => {
  if (!dtStr) return '—';
  const d = new Date(dtStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hrs}:${mins}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const DetailRow = ({ icon, label, value, valueStyle }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIconWrap}>
      <MCIcon name={icon} size={18} color={COLORS.primary} />
    </View>
    <View style={styles.detailContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueStyle]}>{value || '—'}</Text>
    </View>
  </View>
);

const SectionDivider = () => <View style={styles.divider} />;

// ─── Screen ───────────────────────────────────────────────────────────────────

const LeaveDetailScreen = ({ navigation, route }) => {
  const { leaveId } = route.params;
  const leaves = useLeaveStore((s) => s.leaves);
  const cancelLeave = useLeaveStore((s) => s.cancelLeave);

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [slotsExpanded, setSlotsExpanded] = useState(false);
  const [allDbSlots, setAllDbSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Sync / Fetch single detail
  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await leaveService.get(leaveId);
      setDetail(data);
    } catch (err) {
      console.warn('Failed to load leave detail:', err);
      // Fallback to store item if API call fails
      const cached = leaves.find((l) => l.id === leaveId);
      if (cached) {
        setDetail(cached);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();

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
  }, [leaveId]);

  if (loading && !detail) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Leave Details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Leave Details" onBack={() => navigation.goBack()} />
        <View style={styles.notFound}>
          <MCIcon name="alert-circle-outline" size={48} color={COLORS.border} />
          <Text style={styles.notFoundText}>Leave record not found.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadDetail}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusLabel = getStatusLabel(detail.status);
  const statusCfg = STATUS_CONFIG[statusLabel] || STATUS_CONFIG.Pending;

  const leaveType = detail.leaveType || detail.leave_type || detail.type;
  const startDate = detail.startDate || detail.start_date;
  const endDate = detail.endDate || detail.end_date;
  const startTime = detail.startTime || detail.start_time;
  const endTime = detail.endTime || detail.end_time;
  const appliedAt = detail.appliedAt || detail.applied_at || detail.created_at;
  const approvedAt = detail.approvedAt || detail.approved_at;
  const updatedAt = detail.updatedAt || detail.updated_at;
  const adminReason = detail.adminReason || detail.admin_reason;

  const handleCancelPress = () => {
    Alert.alert(
      'Cancel Leave Request',
      'Are you sure you want to cancel this leave request? This cannot be undone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelLeave(leaveId);
              showSuccess('Leave request cancelled successfully.');
              navigation.goBack();
            } catch (err) {
              showError(err.message || 'Failed to cancel leave request.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const parseHourAndAmPm = (tStr) => {
    if (!tStr) return { hr: 0, min: '00', ampm: '' };
    const match12 = tStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match12) {
      return { hr: parseInt(match12[1], 10), min: match12[2], ampm: match12[3].toUpperCase() };
    }
    const match24 = tStr.match(/(\d+):(\d+)/);
    if (match24) {
      let hr = parseInt(match24[1], 10);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12 || 12;
      return { hr, min: match24[2], ampm };
    }
    return { hr: 0, min: '00', ampm: '' };
  };

  const formatSlotLabel = (startStr, endStr) => {
    if (!startStr || !endStr) return '';
    const startInfo = parseHourAndAmPm(startStr);
    const endInfo = parseHourAndAmPm(endStr);
    const padHr = hr => String(hr).padStart(2, '0');

    if (startInfo.ampm === endInfo.ampm) {
      return `${padHr(startInfo.hr)}-${padHr(endInfo.hr)} ${startInfo.ampm}`;
    }
    return `${padHr(startInfo.hr)} ${startInfo.ampm} - ${padHr(endInfo.hr)} ${endInfo.ampm}`;
  };

  const isSlotSelected = (availSlot) => {
    return (detail.slots || []).some(s => {
      const sId = s.slotTimingId || s.slot_timing_id || s.id;
      return sId === availSlot.id;
    });
  };

  const renderSlotsGrid = (availableSlots) => {
    const selectedCount = (detail.slots || []).length;
    const totalCount = availableSlots.length;
    const slotsToDisplay = slotsExpanded ? availableSlots : availableSlots.slice(0, 3);

    return (
      <View style={styles.gridContainer}>
        <View style={styles.gridHeaderRow}>
          <Text style={styles.gridTitle}>Selected Time Slots</Text>
          <Text style={styles.gridSummaryText}>{selectedCount} of {totalCount} Slots Selected</Text>
        </View>

        <View style={styles.slotsGridWrap}>
          {slotsToDisplay.map((slot) => {
            const isSelected = isSlotSelected(slot);
            const label = formatSlotLabel(slot.start_time, slot.end_time);

            return (
              <View key={slot.id} style={styles.gridCellWrapper}>
                <View
                  style={[
                    styles.gridCell,
                    isSelected ? styles.gridCellSelected : styles.gridCellUnselected,
                  ]}
                >
                  <Text
                    style={[
                      styles.gridCellText,
                      isSelected ? styles.gridCellTextSelected : styles.gridCellTextUnselected,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {availableSlots.length > 3 && (
          <TouchableOpacity
            style={styles.toggleGridBtn}
            activeOpacity={0.7}
            onPress={() => setSlotsExpanded(!slotsExpanded)}
          >
            <Text style={styles.toggleGridBtnText}>
              {slotsExpanded ? 'Show Less' : `Show All (${totalCount})`}
            </Text>
            <MCIcon
              name={slotsExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSelectedSlotsSection = () => {
    if (!detail.slots || detail.slots.length === 0) return null;

    if (loadingSlots) {
      return (
        <View style={styles.slotsLoadingWrap}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.slotsLoadingText}>Loading slots grid...</Text>
        </View>
      );
    }

    // Determine day of week from startDate
    const date = new Date(startDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];

    const dayGroup = allDbSlots.find((d) => d.day === dayName);
    const availableSlots = dayGroup ? dayGroup.slots : [];

    // Fallback: if availableSlots is empty, construct it from detail.slots
    const slotsToRender = availableSlots.length > 0 
      ? availableSlots 
      : detail.slots.map(s => ({
          id: s.slotTimingId || s.slot_timing_id || s.id,
          start_time: s.startTime || s.start_time,
          end_time: s.endTime || s.end_time,
        }));

    return (
      <>
        <SectionDivider />
        {renderSlotsGrid(slotsToRender)}
      </>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Leave Details" onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Status Banner ─────────────────────────────────────────────── */}
        <View style={[styles.statusBanner, { backgroundColor: statusCfg.bg }]}>
          <MCIcon name={statusCfg.icon} size={24} color={statusCfg.text} />
          <Text style={[styles.statusBannerText, { color: statusCfg.text }]}>
            {statusLabel}
          </Text>
        </View>

        {/* ── Leave Info Card ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>Leave Information</Text>

          <DetailRow
            icon="tag-outline"
            label="Leave Type"
            value={leaveType ? (leaveType === 'single' ? 'Single Day' : leaveType === 'multiple' ? 'Multiple Days' : 'Custom Slots') : ''}
          />
          <SectionDivider />
          
          <DetailRow
            icon="calendar-outline"
            label="Date"
            value={
              formatDate(startDate) === formatDate(endDate) || leaveType === 'single'
                ? formatDate(startDate)
                : `${formatDate(startDate)} - ${formatDate(endDate)}`
            }
          />

          {/* Time range (for single day) */}
          {leaveType === 'single' && (startTime || endTime) ? (
            <>
              <SectionDivider />
              <DetailRow
                icon="clock-outline"
                label="Unavailable Time"
                value={`${startTime || '—'} - ${endTime || '—'}`}
              />
            </>
          ) : null}

          {/* Selected slots list */}
          {renderSelectedSlotsSection()}

          <SectionDivider />
          <DetailRow
            icon="text-box-outline"
            label="Reason"
            value={detail.reason}
          />

          {detail.notes ? (
            <>
              <SectionDivider />
              <DetailRow
                icon="pencil-outline"
                label="Notes"
                value={detail.notes}
              />
            </>
          ) : null}

          <SectionDivider />
          <DetailRow
            icon="calendar-plus"
            label="Applied Date"
            value={formatDate(appliedAt)}
          />

          {/* Conditional Decision / Details inside the same card */}
          {detail.status === 'approved' && approvedAt ? (
            <>
              <SectionDivider />
              <DetailRow
                icon="calendar-check"
                label="Approved Date"
                value={formatDateTime(approvedAt)}
                valueStyle={{ color: '#065F46' }}
              />
            </>
          ) : null}

          {detail.status === 'rejected' ? (
            <>
              {approvedAt ? (
                <>
                  <SectionDivider />
                  <DetailRow
                    icon="calendar-remove"
                    label="Rejected Date"
                    value={formatDateTime(approvedAt)}
                    valueStyle={{ color: '#991B1B' }}
                  />
                </>
              ) : null}
              <SectionDivider />
              <DetailRow
                icon="message-alert-outline"
                label="Rejection Reason"
                value={adminReason || 'No reason provided.'}
                valueStyle={{ color: '#991B1B' }}
              />
            </>
          ) : null}

          {detail.status === 'cancelled' && updatedAt ? (
            <>
              <SectionDivider />
              <DetailRow
                icon="calendar-remove"
                label="Cancelled Date"
                value={formatDateTime(updatedAt)}
                valueStyle={{ color: '#4B5563' }}
              />
            </>
          ) : null}
        </View>

        {/* Conditional status sections removed - merged inside the card above */}

        {/* ── Cancel Button (Pending only) ───────────────────────────────── */}
        {detail.status === 'pending' && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleCancelPress}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={COLORS.danger} />
            ) : (
              <>
                <MCIcon name="cancel" size={18} color={COLORS.danger} />
                <Text style={styles.cancelBtnText}>Cancel Request</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

export default LeaveDetailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  statusBannerText: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 1,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  approvedCard: {
    borderColor: '#A7F3D0',
  },
  rejectedCard: {
    borderColor: '#FECACA',
  },
  cardSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.md,
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  detailIconWrap: {
    width: 32,
    alignItems: 'center',
    paddingTop: 2,
  },
  detailContent: {
    flex: 1,
    paddingLeft: SPACING.xs,
  },
  detailLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  slotsLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
  },
  slotsLoadingText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  gridContainer: {
    paddingVertical: SPACING.md,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  gridSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  slotsGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginTop: 2,
  },
  gridCellWrapper: {
    width: '33.33%',
    padding: 4,
  },
  gridCell: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  gridCellSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
  },
  gridCellUnselected: {
    backgroundColor: '#F3F4F6',
    borderColor: COLORS.border,
  },
  gridCellText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  gridCellTextSelected: {
    color: COLORS.white,
  },
  gridCellTextUnselected: {
    color: COLORS.textSecondary,
  },

  toggleGridBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  toggleGridBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.primary,
  },

  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginTop: SPACING.xs,
  },
  cancelBtnDisabled: {
    borderColor: COLORS.textMuted,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.danger,
  },

  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 80,
  },
  notFoundText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  retryBtnText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
});
