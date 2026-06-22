import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
import TimePickerModal from '../components/TimePickerModal';
import SkeletonBox, { LeaveCardSkeleton, LeaveStatsSkeleton } from '../components/SkeletonLoader';

const STATUS_COLORS = {
  pending: { bg: '#F59E0B', label: 'Pending' },
  approved: { bg: '#10B981', label: 'Approved' },
  rejected: { bg: '#EF4444', label: 'Rejected' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CalendarPicker = ({ value, onSelect }) => {
  const today = new Date();
  const initial = value ? new Date(value + 'T00:00:00') : today;
  const [viewMonth, setViewMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const todayStr = today.toISOString().slice(0, 10);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const fmt = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <View>
      <View style={styles.calHeader}>
        <TouchableOpacity onPress={() => setViewMonth(new Date(year, month - 1, 1))} style={styles.calNav}>
          <MCIcon name="chevron-left" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.calTitle}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={() => setViewMonth(new Date(year, month + 1, 1))} style={styles.calNav}>
          <MCIcon name="chevron-right" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.calDayNames}>
        {DAY_NAMES.map(d => <Text key={d} style={styles.calDayNameText}>{d}</Text>)}
      </View>
      <View style={styles.calGrid}>
        {days.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={styles.calDayCell} />;
          const ds = fmt(day);
          const selected = value === ds;
          const isToday = ds === todayStr;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.calDayCell, selected && styles.calDaySelected]}
              onPress={() => onSelect(ds)}
            >
              <Text style={[styles.calDayNum, selected && styles.calDayNumSelected, isToday && !selected && styles.calDayToday]}>
                {day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const LeaveCard = ({ leave, onPress, onStatusUpdate }) => {
  const status = STATUS_COLORS[leave.status] || { bg: '#999', label: leave.status };
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(leave)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <MCIcon name="calendar-remove" size={20} color={COLORS.primary} />
          <Text style={styles.leaveDate}>{leave.leave_date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: status.bg }]} />
          <Text style={[styles.statusText, { color: status.bg }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <MCIcon name="doctor" size={16} color={COLORS.primary} />
          <Text style={styles.cardLabel}>Doctor:</Text>
          <Text style={styles.cardValue}>{leave.doctor_name || leave.doctor_id}</Text>
        </View>
        {leave.slot_time ? (
          <View style={styles.cardRow}>
            <MCIcon name="clock-outline" size={16} color={COLORS.warning} />
            <Text style={styles.cardLabel}>Slot:</Text>
            <Text style={styles.cardValue}>
              {leave.slot_time.start_time} - {leave.slot_time.end_time}
            </Text>
          </View>
        ) : (
          <View style={styles.cardRow}>
            <MCIcon name="calendar-remove" size={16} color={COLORS.textMuted} />
            <Text style={styles.cardLabel}>Type:</Text>
            <Text style={styles.cardValue}>Full Day</Text>
          </View>
        )}
        {leave.doctor_reason && (
          <View style={styles.cardRow}>
            <MCIcon name="comment-text-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.cardLabel}>Reason:</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{leave.doctor_reason}</Text>
          </View>
        )}
      </View>

      {leave.status === 'pending' && (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B98115' }]}
            onPress={() => onStatusUpdate(leave, 'approved')}
          >
            <MCIcon name="check" size={16} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#EF444415' }]}
            onPress={() => onStatusUpdate(leave, 'rejected')}
          >
            <MCIcon name="close" size={16} color="#EF4444" />
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const DoctorLeaveManagementScreen = ({ navigation }) => {
  const [leaves, setLeaves] = useState([]);
  const [kpiStats, setKpiStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [draftLeaveType, setDraftLeaveType] = useState('');
  const [draftTimeFrom, setDraftTimeFrom] = useState('');
  const [draftTimeTo, setDraftTimeTo] = useState('');

  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');
  const [appliedLeaveType, setAppliedLeaveType] = useState('');
  const [appliedTimeFrom, setAppliedTimeFrom] = useState('');
  const [appliedTimeTo, setAppliedTimeTo] = useState('');

  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState(null);

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null);

  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [adminReason, setAdminReason] = useState('');

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLeave, setDetailLeave] = useState(null);

  const to24Hour = (time12) => {
    if (!time12) return '';
    const [time, mod] = time12.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (mod === 'PM' && h !== 12) h += 12;
    if (mod === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const hasActiveFilters = appliedFromDate || appliedToDate || appliedLeaveType || appliedTimeFrom || appliedTimeTo;

  const buildParams = useCallback(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    if (appliedFromDate) params.from_date = appliedFromDate;
    if (appliedToDate) params.to_date = appliedToDate;
    if (appliedLeaveType) params.leave_type = appliedLeaveType;
    if (appliedTimeFrom) params.time_from = to24Hour(appliedTimeFrom);
    if (appliedTimeTo) params.time_to = to24Hour(appliedTimeTo);
    return params;
  }, [debouncedSearch, statusFilter, appliedFromDate, appliedToDate, appliedLeaveType, appliedTimeFrom, appliedTimeTo]);

  const fetchLeaves = useCallback(() => {
    setLoading(true);
    apiClient
      .get(ENDPOINTS.DOCTOR_LEAVES, { params: buildParams() })
      .then(res => setLeaves(res?.data || []))
      .catch(() => Alert.alert('Error', 'Failed to fetch leaves'))
      .finally(() => setLoading(false));
  }, [buildParams]);

  const fetchKpiStats = useCallback(() => {
    apiClient
      .get(ENDPOINTS.DOCTOR_LEAVES_STATS)
      .then(res => {
        if (res?.data) setKpiStats(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLeaves();
    fetchKpiStats();
  }, [fetchLeaves, fetchKpiStats]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const openDetailModal = (leave) => {
    setDetailLeave(leave);
    setDetailModalVisible(true);
  };

  const openStatusModal = (leave, status) => {
    setSelectedLeave(leave);
    setNewStatus(status);
    setAdminReason('');
    setStatusModalVisible(true);
  };

  const confirmStatusUpdate = () => {
    if (!selectedLeave) return;
    setLoading(true);
    const payload = { status: newStatus };
    if (adminReason) payload.admin_reason = adminReason;

    apiClient
      .patch(ENDPOINTS.DOCTOR_LEAVES_UPDATE_STATUS(selectedLeave.id), payload)
      .then(() => {
        Alert.alert('Success', `Leave ${newStatus} successfully`);
        setStatusModalVisible(false);
        fetchLeaves();
        fetchKpiStats();
      })
      .catch(() => Alert.alert('Error', 'Failed to update leave status'))
      .finally(() => setLoading(false));
  };

  const openFilterModal = () => {
    setDraftFromDate(appliedFromDate);
    setDraftToDate(appliedToDate);
    setDraftLeaveType(appliedLeaveType);
    setDraftTimeFrom(appliedTimeFrom);
    setDraftTimeTo(appliedTimeTo);
    setCalendarTarget(null);
    setCalendarModalVisible(false);
    setFilterModalVisible(true);
  };

  const openCalendarPicker = (target) => {
    setCalendarTarget(target);
    setCalendarModalVisible(true);
  };

  const openTimePicker = (target) => {
    setTimePickerTarget(target);
    setTimePickerVisible(true);
  };

  const applyFilters = () => {
    setAppliedFromDate(draftFromDate);
    setAppliedToDate(draftToDate);
    setAppliedLeaveType(draftLeaveType);
    setAppliedTimeFrom(draftTimeFrom);
    setAppliedTimeTo(draftTimeTo);
    setFilterModalVisible(false);
    fetchLeaves();
  };

  const setQuickDate = (label) => {
    const now = new Date();
    if (label === 'Today') {
      setDraftFromDate(now.toISOString().slice(0, 10));
      setDraftToDate(now.toISOString().slice(0, 10));
    } else if (label === 'This Week') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const end = new Date(now);
      end.setDate(start.getDate() + 6);
      setDraftFromDate(start.toISOString().slice(0, 10));
      setDraftToDate(end.toISOString().slice(0, 10));
    } else {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDraftFromDate(start.toISOString().slice(0, 10));
      setDraftToDate(end.toISOString().slice(0, 10));
    }
  };

  const clearAllFilters = () => {
    setDraftFromDate('');
    setDraftToDate('');
    setDraftLeaveType('');
    setDraftTimeFrom('');
    setDraftTimeTo('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setAppliedLeaveType('');
    setAppliedTimeFrom('');
    setAppliedTimeTo('');
    setFilterModalVisible(false);
    fetchLeaves();
  };

  const renderHeader = () => (
    <View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: '#F59E0B' }]}>
          <Text style={styles.statVal}>{kpiStats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#10B981' }]}>
          <Text style={styles.statVal}>{kpiStats.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statCard, { borderColor: '#EF4444' }]}>
          <Text style={styles.statVal}>{kpiStats.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusTabs}>
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <TouchableOpacity
            key={s || 'all'}
            style={[styles.statusTab, statusFilter === s && styles.statusTabActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text style={[styles.statusTabText, statusFilter === s && styles.statusTabTextActive]}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {hasActiveFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeChipRow}>
          {appliedFromDate ? <View style={styles.chip}><Text style={styles.chipText}>From: {appliedFromDate}</Text></View> : null}
          {appliedToDate ? <View style={styles.chip}><Text style={styles.chipText}>To: {appliedToDate}</Text></View> : null}
          {appliedLeaveType ? <View style={styles.chip}><Text style={styles.chipText}>{appliedLeaveType === 'full_day' ? 'Full Day' : 'Partial'}</Text></View> : null}
          {appliedTimeFrom ? <View style={styles.chip}><Text style={styles.chipText}>From: {appliedTimeFrom}</Text></View> : null}
          {appliedTimeTo ? <View style={styles.chip}><Text style={styles.chipText}>To: {appliedTimeTo}</Text></View> : null}
        </ScrollView>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctor Leaves</Text>
        <TouchableOpacity onPress={openFilterModal} style={styles.filterBtn}>
          <MCIcon name="filter-variant" size={22} color={hasActiveFilters ? COLORS.primary : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <MCIcon name="magnify" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by doctor name..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MCIcon name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading && leaves.length === 0 ? (
        <View>
          <LeaveStatsSkeleton />
          <View style={styles.skeletonTabs}>
            {[1, 2, 3, 4].map(i => <SkeletonBox key={i} width={64} height={32} borderRadius={20} />)}
          </View>
          {[1, 2, 3, 4].map(i => <LeaveCardSkeleton key={i} />)}
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <LeaveCard leave={item} onPress={openDetailModal} onStatusUpdate={openStatusModal} />
          )}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={() => { fetchLeaves(); fetchKpiStats(); }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MCIcon name="calendar-remove" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No leaves found</Text>
            </View>
          }
        />
      )}

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailModalVisible(false)}>
          <View style={styles.modalContainer}>
            {detailLeave && (() => {
              const sc = STATUS_COLORS[detailLeave.status] || { bg: '#999', label: detailLeave.status };
              const statusIcon = detailLeave.status === 'approved' ? 'check-circle' : detailLeave.status === 'rejected' ? 'close-circle' : 'clock-outline';
              return (
                <>
                  <View style={[styles.detailStatusHeader, { backgroundColor: sc.bg }]}>
                    <MCIcon name={statusIcon} size={28} color="#fff" />
                    <View style={styles.detailStatusHeaderText}>
                      <Text style={styles.detailStatusHeaderLabel}>{sc.label}</Text>
                      <Text style={styles.detailStatusHeaderDate}>{detailLeave.leave_date}</Text>
                    </View>
                  </View>

                  <View style={styles.detailBody}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailIconCircle}>
                        <MCIcon name="doctor" size={20} color={COLORS.primary} />
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailFieldLabel}>Doctor</Text>
                        <Text style={styles.detailFieldValue}>{detailLeave.doctor_name || detailLeave.doctor_id}</Text>
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconCircle}>
                        <MCIcon name="calendar" size={20} color={COLORS.primary} />
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailFieldLabel}>Leave Date</Text>
                        <Text style={styles.detailFieldValue}>{detailLeave.leave_date}</Text>
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconCircle}>
                        <MCIcon name="clock-outline" size={20} color={COLORS.warning} />
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailFieldLabel}>Leave Type</Text>
                        <Text style={styles.detailFieldValue}>
                          {detailLeave.slot_time
                            ? `${detailLeave.slot_time.start_time} - ${detailLeave.slot_time.end_time}`
                            : 'Full Day'}
                        </Text>
                      </View>
                    </View>

                    {detailLeave.doctor_reason && (
                      <>
                        <View style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconCircle}>
                            <MCIcon name="comment-text-outline" size={20} color={COLORS.textMuted} />
                          </View>
                          <View style={styles.detailCol}>
                            <Text style={styles.detailFieldLabel}>Doctor Reason</Text>
                            <Text style={styles.detailReasonText}>{detailLeave.doctor_reason}</Text>
                          </View>
                        </View>
                      </>
                    )}

                    {detailLeave.admin_reason && (
                      <>
                        <View style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconCircle}>
                            <MCIcon name="shield-check" size={20} color={COLORS.textMuted} />
                          </View>
                          <View style={styles.detailCol}>
                            <Text style={styles.detailFieldLabel}>Admin Reason</Text>
                            <Text style={styles.detailReasonText}>{detailLeave.admin_reason}</Text>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                </>
              );
            })()}
            <TouchableOpacity style={styles.closeDetailBtn} onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.closeDetailBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Status Update Modal */}
      <Modal visible={statusModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setStatusModalVisible(false)}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{newStatus === 'approved' ? 'Approve' : 'Reject'} Leave</Text>
            {selectedLeave && (
              <Text style={styles.modalSubtitle}>
                {selectedLeave.doctor_name || selectedLeave.doctor_id} - {selectedLeave.leave_date}
              </Text>
            )}
            {selectedLeave?.doctor_reason && (
              <Text style={styles.modalReason}>Doctor reason: {selectedLeave.doctor_reason}</Text>
            )}
            <Text style={styles.inputLabel}>Admin Reason (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason..."
              placeholderTextColor={COLORS.textMuted}
              value={adminReason}
              onChangeText={setAdminReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancelBtn]} onPress={() => setStatusModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: newStatus === 'approved' ? '#10B981' : '#EF4444' }]}
                onPress={confirmStatusUpdate}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={filterModalVisible} transparent animationType="slide">
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContainer}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <MCIcon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterSectionLabel}>Date Range</Text>
              <View style={styles.filterDateRow}>
                <View style={styles.filterDateGroup}>
                  <Text style={styles.filterFieldLabel}>From</Text>
                  <TouchableOpacity style={styles.filterDateBtn} onPress={() => openCalendarPicker('from')}>
                    <Text style={[styles.filterDateBtnText, !draftFromDate && styles.filterPlaceholder]}>
                      {draftFromDate || 'Select date'}
                    </Text>
                    <MCIcon name="calendar-month" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.filterDateSep}>-</Text>
                <View style={styles.filterDateGroup}>
                  <Text style={styles.filterFieldLabel}>To</Text>
                  <TouchableOpacity style={styles.filterDateBtn} onPress={() => openCalendarPicker('to')}>
                    <Text style={[styles.filterDateBtnText, !draftToDate && styles.filterPlaceholder]}>
                      {draftToDate || 'Select date'}
                    </Text>
                    <MCIcon name="calendar-month" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterQuickDates}>
                {['Today', 'This Week', 'This Month'].map(label => (
                  <TouchableOpacity key={label} style={styles.quickDateBtn} onPress={() => setQuickDate(label)}>
                    <Text style={styles.quickDateText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.filterSectionLabel, { marginTop: 20 }]}>Leave Type</Text>
              <View style={styles.leaveTypeRow}>
                {[
                  { value: '', label: 'All' },
                  { value: 'full_day', label: 'Full Day' },
                  { value: 'partial', label: 'Partial' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.leaveTypeBtn, draftLeaveType === opt.value && styles.leaveTypeBtnActive]}
                    onPress={() => setDraftLeaveType(opt.value)}
                  >
                    <Text style={[styles.leaveTypeText, draftLeaveType === opt.value && styles.leaveTypeTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {draftLeaveType === 'partial' && (
                <View style={styles.timeRangeSection}>
                  <Text style={styles.filterSectionLabel}>Time Range</Text>
                  <View style={styles.filterDateRow}>
                    <View style={styles.filterDateGroup}>
                      <Text style={styles.filterFieldLabel}>From</Text>
                      <TouchableOpacity style={styles.filterDateBtn} onPress={() => openTimePicker('from')}>
                        <Text style={[styles.filterDateBtnText, !draftTimeFrom && styles.filterPlaceholder]}>
                          {draftTimeFrom || 'Select time'}
                        </Text>
                        <MCIcon name="clock-outline" size={18} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.filterDateSep}>-</Text>
                    <View style={styles.filterDateGroup}>
                      <Text style={styles.filterFieldLabel}>To</Text>
                      <TouchableOpacity style={styles.filterDateBtn} onPress={() => openTimePicker('to')}>
                        <Text style={[styles.filterDateBtnText, !draftTimeTo && styles.filterPlaceholder]}>
                          {draftTimeTo || 'Select time'}
                        </Text>
                        <MCIcon name="clock-outline" size={18} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.filterModalActions}>
              <TouchableOpacity style={styles.filterCancelBtn} onPress={() => setFilterModalVisible(false)}>
                <Text style={styles.filterCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterClearBtn} onPress={clearAllFilters}>
                <MCIcon name="close-circle-outline" size={18} color={COLORS.danger} />
                <Text style={styles.filterClearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyBtn} onPress={applyFilters}>
                <MCIcon name="filter-check" size={18} color={COLORS.white} />
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={calendarModalVisible} transparent animationType="fade">
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContainer}>
            <Text style={styles.calendarModalTitle}>
              Select {calendarTarget === 'from' ? 'From' : 'To'} Date
            </Text>
            <CalendarPicker
              value={calendarTarget === 'from' ? draftFromDate : draftToDate}
              onSelect={(d) => {
                if (calendarTarget === 'from') setDraftFromDate(d);
                else setDraftToDate(d);
                setCalendarModalVisible(false);
              }}
            />
            <TouchableOpacity style={styles.calendarDoneBtn} onPress={() => setCalendarModalVisible(false)}>
              <Text style={styles.calendarDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <TimePickerModal
        visible={timePickerVisible}
        onClose={() => setTimePickerVisible(false)}
        initialTime={timePickerTarget === 'from' ? draftTimeFrom : draftTimeTo}
        onSelect={(timeStr) => {
          if (timePickerTarget === 'from') setDraftTimeFrom(timeStr);
          else setDraftTimeTo(timeStr);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 56, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: COLORS.white,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },
  filterBtn: { padding: 6 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    marginHorizontal: 12, marginTop: 12, marginBottom: 4, borderRadius: 25,
    paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, marginLeft: 8, padding: 0 },
  list: { paddingBottom: 24 },
  statsRow: { flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 8 },
  skeletonTabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  statVal: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  statusTabs: { paddingHorizontal: 16, marginBottom: 8 },
  statusTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceMuted, marginRight: 8 },
  statusTabActive: { backgroundColor: COLORS.primary },
  statusTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  statusTabTextActive: { color: COLORS.white },
  activeChipRow: { paddingHorizontal: 16, marginBottom: 8 },
  chip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 6 },
  chipText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  card: {
    backgroundColor: COLORS.white, borderRadius: 12, marginHorizontal: 16, marginBottom: 10,
    padding: 14, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leaveDate: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBody: { gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  cardValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  actionText: { fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: COLORS.textMuted },

  // Filter Modal
  filterModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterModalContainer: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  filterModalBody: { padding: 20 },
  filterSectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  filterDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  filterDateGroup: { flex: 1 },
  filterFieldLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  filterDateBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8, paddingHorizontal: 12, height: 44, justifyContent: 'space-between',
  },
  filterDateBtnText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
  filterPlaceholder: { color: COLORS.textMuted, fontWeight: '400' },
  filterDateSep: { fontSize: 16, fontWeight: '700', color: COLORS.textMuted, paddingBottom: 10 },
  filterQuickDates: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickDateBtn: { flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quickDateText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  leaveTypeRow: { flexDirection: 'row', gap: 8 },
  leaveTypeBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ddd', backgroundColor: COLORS.white },
  leaveTypeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  leaveTypeText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  leaveTypeTextActive: { color: COLORS.white },
  timeRangeSection: { marginTop: 16 },
  filterModalActions: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 10 },
  filterCancelBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.surfaceMuted },
  filterCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  filterClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  filterClearText: { fontSize: 14, fontWeight: '600', color: COLORS.danger },
  filterApplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primary },
  filterApplyText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNav: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center' },
  calTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  calDayNames: { flexDirection: 'row', marginBottom: 8 },
  calDayNameText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  calDaySelected: { backgroundColor: COLORS.primary, borderRadius: 20 },
  calDayNum: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  calDayNumSelected: { color: COLORS.white, fontWeight: '700' },
  calDayToday: { color: COLORS.primary, fontWeight: '700' },

  // Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4, paddingHorizontal: 20 },
  modalSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8, paddingHorizontal: 20 },
  modalReason: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16, fontStyle: 'italic', paddingHorizontal: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 8, paddingHorizontal: 20 },
  modalInput: { backgroundColor: COLORS.surfaceMuted, borderRadius: 8, padding: 12, fontSize: 14, color: COLORS.textPrimary, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#eee', marginHorizontal: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, paddingHorizontal: 20, paddingBottom: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancelBtn: { backgroundColor: COLORS.surfaceMuted },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  detailStatusHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 20, gap: 14,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  detailStatusHeaderText: { flex: 1 },
  detailStatusHeaderLabel: { fontSize: 22, fontWeight: '800', color: '#fff' },
  detailStatusHeaderDate: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },
  detailBody: { padding: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, justifyContent: 'center', alignItems: 'center' },
  detailCol: { flex: 1 },
  detailFieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailFieldValue: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  detailReasonText: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 20, marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  closeDetailBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 20, marginBottom: 20 },
  closeDetailBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  // Calendar Modal styles
  calendarModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  calendarModalContainer: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  calendarModalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center', marginBottom: 12 },
  calendarDoneBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  calendarDoneText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

});

export default DoctorLeaveManagementScreen;
