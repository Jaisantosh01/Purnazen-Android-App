import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { LEAVE_STATUS_COLORS as STATUS_COLORS, DAY_NAMES, MONTH_NAMES } from '../constants/appointments';
import TimePickerModal from '../components/TimePickerModal';
import SkeletonBox, { LeaveCardSkeleton, LeaveStatsSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert } from '../utils/alert';

const CalendarPicker = ({ value, onSelect }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
          <MCIcon name="chevron-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.calTitle}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={() => setViewMonth(new Date(year, month + 1, 1))} style={styles.calNav}>
          <MCIcon name="chevron-right" size={22} color={colors.textPrimary} />
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const status = STATUS_COLORS[leave.status] || { bg: '#999', label: leave.status };

  const renderLeaveInfo = () => {
    if (leave.leaveType === 'single') {
      return (
        <>
          {leave.startTime && leave.endTime ? (
            <View style={styles.cardRow}>
              <MCIcon name="clock-outline" size={16} color={colors.warning} />
              <Text style={styles.cardLabel}>Time:</Text>
              <Text style={styles.cardValue}>{leave.startTime} - {leave.endTime}</Text>
            </View>
          ) : (
            <View style={styles.cardRow}>
              <MCIcon name="calendar-remove" size={16} color={colors.textMuted} />
              <Text style={styles.cardLabel}>Type:</Text>
              <Text style={styles.cardValue}>Full Day</Text>
            </View>
          )}
        </>
      );
    } else if (leave.leaveType === 'multiple') {
      return (
        <View style={styles.cardRow}>
          <MCIcon name="calendar-range" size={16} color={colors.primary} />
          <Text style={styles.cardLabel}>Range:</Text>
          <Text style={styles.cardValue}>{leave.startDate || leave.leaveDate || '—'} to {leave.endDate || leave.startDate || '—'}</Text>
        </View>
      );
    } else if (leave.leaveType === 'custom') {
      return (
        <>
          {leave.slots?.map((slot, idx) => (
            <View key={idx} style={styles.cardRow}>
              <MCIcon name="clock-outline" size={16} color={colors.warning} />
              <Text style={styles.cardLabel}>Slot {idx + 1}:</Text>
              <Text style={styles.cardValue}>{slot.start_time} - {slot.end_time}</Text>
            </View>
          ))}
        </>
      );
    }
    return null;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(leave)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <MCIcon name="calendar-remove" size={20} color={colors.primary} />
          <Text style={styles.leaveDate} numberOfLines={1}>
            {leave.leaveType === 'multiple'
              ? (leave.startDate ? `${leave.startDate} - ${leave.endDate || ''}` : leave.leaveDate || leave.startDate || '—')
              : leave.leaveDate || leave.startDate || '—'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: status.bg }]} />
          <Text style={[styles.statusText, { color: status.bg }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <MCIcon name="doctor" size={16} color={colors.primary} />
          <Text style={styles.cardLabel}>Doctor:</Text>
          <Text style={styles.cardValue} numberOfLines={1}>{leave.doctorName || leave.doctorId}</Text>
        </View>
        {renderLeaveInfo()}
        {leave.reason && (
          <View style={styles.cardRow}>
            <MCIcon name="comment-text-outline" size={16} color={colors.textMuted} />
            <Text style={styles.cardLabel}>Reason:</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{leave.reason}</Text>
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

const DoctorLeaveManagementScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [leaves, setLeaves] = useState([]);
  const [kpiStats, setKpiStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(route?.params?.initialStatus || '');

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [draftPartialDay, setDraftPartialDay] = useState(false);
  const [draftTimeFrom, setDraftTimeFrom] = useState('');
  const [draftTimeTo, setDraftTimeTo] = useState('');

const [appliedFromDate, setAppliedFromDate] = useState(route?.params?.initialFromDate || '');
const [appliedToDate, setAppliedToDate] = useState(route?.params?.initialToDate || '');
const [appliedPartialDay, setAppliedPartialDay] = useState(false);
const [appliedTimeFrom, setAppliedTimeFrom] = useState('');
const [appliedTimeTo, setAppliedTimeTo] = useState('');

const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);
const [loadingMore, setLoadingMore] = useState(false);

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

  const hasActiveFilters = appliedFromDate || appliedToDate || appliedPartialDay || appliedTimeFrom || appliedTimeTo;

  const buildParams = useCallback(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    if (appliedFromDate) params.from_date = appliedFromDate;
    if (appliedToDate) params.to_date = appliedToDate;
    if (appliedPartialDay) params.leave_type = 'custom';
    if (appliedTimeFrom) params.time_from = to24Hour(appliedTimeFrom);
    if (appliedTimeTo) params.time_to = to24Hour(appliedTimeTo);
    return params;
  }, [debouncedSearch, statusFilter, appliedFromDate, appliedToDate, appliedPartialDay, appliedTimeFrom, appliedTimeTo]);

  const fetchLeaves = useCallback((pageNum = 1, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    const params = { ...buildParams(), page: pageNum, per_page: 20 };
    apiClient
      .get(ENDPOINTS.DOCTOR_LEAVES + '/admin', { params })
      .then(res => {
        const newLeaves = res?.data?.leaves || [];
        setLeaves(prev => append ? [...prev, ...newLeaves] : newLeaves);
        setHasMore(pageNum < (res?.data?.total_pages || 0));
        setPage(pageNum);
      })
      .catch(() => showAlert('Error', 'Failed to fetch leaves'))
      .finally(() => { setLoading(false); setLoadingMore(false); });
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
    fetchLeaves(1);
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
        showAlert('Success', `Leave ${newStatus} successfully`);
        setStatusModalVisible(false);
        fetchLeaves();
        fetchKpiStats();
      })
      .catch(() => showAlert('Error', 'Failed to update leave status'))
      .finally(() => setLoading(false));
  };

  const openFilterModal = () => {
    setDraftFromDate(appliedFromDate);
    setDraftToDate(appliedToDate);
    setDraftPartialDay(appliedPartialDay);
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
    setAppliedPartialDay(draftPartialDay);
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
    setDraftPartialDay(false);
    setDraftTimeFrom('');
    setDraftTimeTo('');
    setAppliedFromDate('');
    setAppliedToDate('');
    setAppliedPartialDay(false);
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
          {appliedPartialDay ? <View style={styles.chip}><Text style={styles.chipText}>Partial Day</Text></View> : null}
          {appliedTimeFrom ? <View style={styles.chip}><Text style={styles.chipText}>From: {appliedTimeFrom}</Text></View> : null}
          {appliedTimeTo ? <View style={styles.chip}><Text style={styles.chipText}>To: {appliedTimeTo}</Text></View> : null}
        </ScrollView>
      )}
    </View>
  );

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchLeaves(page + 1, true);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Doctor Leaves"
        subtitle="Review and manage leave requests"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={openFilterModal} style={styles.filterBtn}>
            <MCIcon name="filter-variant" size={22} color={hasActiveFilters ? colors.headerText : 'rgba(255,255,255,0.7)'} />
          </TouchableOpacity>
        }
      />

      <View style={styles.searchContainer}>
        <MCIcon name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by doctor name..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MCIcon name="close-circle" size={20} color={colors.textMuted} />
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
          onRefresh={() => { fetchLeaves(1); fetchKpiStats(); }}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MCIcon name="calendar-remove" size={48} color={colors.textMuted} />
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
                      <Text style={styles.detailStatusHeaderDate}>
                        {detailLeave.leaveType === 'multiple'
                          ? `${detailLeave.startDate || detailLeave.leaveDate || '—'} - ${detailLeave.endDate || detailLeave.startDate || '—'}`
                          : detailLeave.leaveDate || detailLeave.startDate || '—'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailBody}>
                    <View style={styles.detailRow}>
                      <View style={styles.detailIconCircle}>
                        <MCIcon name="doctor" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailFieldLabel}>Doctor</Text>
                        <Text style={styles.detailFieldValue}>{detailLeave.doctorName || detailLeave.doctorId}</Text>
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconCircle}>
                        <MCIcon name="calendar" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailFieldLabel}>Leave Date</Text>
                        {detailLeave.leaveType === 'multiple' ? (
                          <Text style={styles.detailFieldValue}>{detailLeave.startDate || detailLeave.leaveDate || '—'} - {detailLeave.endDate || detailLeave.startDate || '—'}</Text>
                        ) : detailLeave.leaveType === 'custom' ? (
                          <>
                            <Text style={styles.detailFieldValue}>{detailLeave.leaveDate || detailLeave.startDate || '—'}</Text>
                            {detailLeave.slots?.map((slot, idx) => (
                              <Text key={idx} style={styles.detailSlotText}>
                                Slot {idx + 1}: {slot.start_time} - {slot.end_time}
                              </Text>
                            ))}
                          </>
                        ) : (
                          <Text style={styles.detailFieldValue}>{detailLeave.leaveDate || detailLeave.startDate || '—'}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.detailDivider} />

                    <View style={styles.detailRow}>
                      <View style={styles.detailIconCircle}>
                        <MCIcon name="clock-outline" size={20} color={colors.warning} />
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailFieldLabel}>Leave Type</Text>
                        <Text style={styles.detailFieldValue}>
                          {detailLeave.leaveType === 'single'
                            ? 'Single Day'
                            : detailLeave.leaveType === 'multiple'
                            ? 'Multiple Days'
                            : 'Partial Day'}
                        </Text>
                      </View>
                    </View>

                    {detailLeave.leaveType === 'single' && detailLeave.startTime && detailLeave.endTime && (
                      <>
                        <View style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconCircle}>
                            <MCIcon name="clock" size={20} color={colors.warning} />
                          </View>
                          <View style={styles.detailCol}>
                            <Text style={styles.detailFieldLabel}>Time</Text>
                            <Text style={styles.detailFieldValue}>{detailLeave.startTime} - {detailLeave.endTime}</Text>
                          </View>
                        </View>
                      </>
                    )}

                    {detailLeave.leaveType === 'multiple' && (
                      <>
                        <View style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconCircle}>
                            <MCIcon name="calendar-range" size={20} color={colors.primary} />
                          </View>
                          <View style={styles.detailCol}>
                            <Text style={styles.detailFieldLabel}>Date Range</Text>
                            <Text style={styles.detailFieldValue}>{detailLeave.startDate} to {detailLeave.endDate}</Text>
                          </View>
                        </View>
                      </>
                    )}

                    {detailLeave.leaveType === 'custom' && detailLeave.slots?.length > 0 && (
                      <>
                        <View style={styles.detailDivider} />
                        {detailLeave.slots.map((slot, idx) => (
                          <View key={idx} style={styles.detailRow}>
                            <View style={styles.detailIconCircle}>
                              <MCIcon name="clock-outline" size={20} color={colors.warning} />
                            </View>
                            <View style={styles.detailCol}>
                              <Text style={styles.detailFieldLabel}>Slot {idx + 1}</Text>
                              <Text style={styles.detailFieldValue}>{slot.start_time} - {slot.end_time}</Text>
                            </View>
                          </View>
                        ))}
                      </>
                    )}

                    {detailLeave.reason && (
                      <>
                        <View style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconCircle}>
                            <MCIcon name="comment-text-outline" size={20} color={colors.textMuted} />
                          </View>
                          <View style={styles.detailCol}>
                            <Text style={styles.detailFieldLabel}>Doctor Reason</Text>
                            <Text style={styles.detailReasonText}>{detailLeave.reason}</Text>
                          </View>
                        </View>
                      </>
                    )}

                    {detailLeave.adminReason && (
                      <>
                        <View style={styles.detailDivider} />
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconCircle}>
                            <MCIcon name="shield-check" size={20} color={colors.textMuted} />
                          </View>
                          <View style={styles.detailCol}>
                            <Text style={styles.detailFieldLabel}>Admin Reason</Text>
                            <Text style={styles.detailReasonText}>{detailLeave.adminReason}</Text>
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
                {selectedLeave.doctorName || selectedLeave.doctorId} - {selectedLeave.leaveDate || selectedLeave.startDate || '—'}
              </Text>
            )}
            {selectedLeave?.reason && (
              <Text style={styles.modalReason}>Doctor reason: {selectedLeave.reason}</Text>
            )}
            <Text style={styles.inputLabel}>Admin Reason (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter reason..."
              placeholderTextColor={colors.textMuted}
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
                <MCIcon name="close" size={24} color={colors.textPrimary} />
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
                    <MCIcon name="calendar-month" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.filterDateSep}>-</Text>
                <View style={styles.filterDateGroup}>
                  <Text style={styles.filterFieldLabel}>To</Text>
                  <TouchableOpacity style={styles.filterDateBtn} onPress={() => openCalendarPicker('to')}>
                    <Text style={[styles.filterDateBtnText, !draftToDate && styles.filterPlaceholder]}>
                      {draftToDate || 'Select date'}
                    </Text>
                    <MCIcon name="calendar-month" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterQuickDates}>
                {['Today', 'This Week', 'This Month'].map(label => {
                  const now = new Date();
                  let qdFrom, qdTo;
                  if (label === 'Today') {
                    qdFrom = qdTo = now.toISOString().slice(0, 10);
                  } else if (label === 'This Week') {
                    const start = new Date(now);
                    start.setDate(now.getDate() - now.getDay());
                    qdFrom = start.toISOString().slice(0, 10);
                    const end = new Date(now);
                    end.setDate(start.getDate() + 6);
                    qdTo = end.toISOString().slice(0, 10);
                  } else {
                    qdFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                    qdTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
                  }
                  const isActive = draftFromDate === qdFrom && draftToDate === qdTo;
                  return (
                    <TouchableOpacity key={label} style={[styles.quickDateBtn, isActive && styles.quickDateBtnActive]} onPress={() => setQuickDate(label)}>
                      <Text style={[styles.quickDateText, isActive && styles.quickDateTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.partialDayRow}
                onPress={() => setDraftPartialDay(!draftPartialDay)}
              >
                <View style={[styles.checkbox, draftPartialDay && styles.checkboxChecked]}>
                  {draftPartialDay && <MCIcon name="check" size={14} color="#fff" />}
                </View>
                <Text style={styles.partialDayLabel}>Partial Day</Text>
              </TouchableOpacity>

              {draftPartialDay && (
                <View style={styles.timeRangeSection}>
                  <Text style={styles.filterSectionLabel}>Time Range</Text>
                  <View style={styles.filterDateRow}>
                    <View style={styles.filterDateGroup}>
                      <Text style={styles.filterFieldLabel}>From</Text>
                      <TouchableOpacity style={styles.filterDateBtn} onPress={() => openTimePicker('from')}>
                        <Text style={[styles.filterDateBtnText, !draftTimeFrom && styles.filterPlaceholder]}>
                          {draftTimeFrom || 'Select time'}
                        </Text>
                        <MCIcon name="clock-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.filterDateSep}>-</Text>
                    <View style={styles.filterDateGroup}>
                      <Text style={styles.filterFieldLabel}>To</Text>
                      <TouchableOpacity style={styles.filterDateBtn} onPress={() => openTimePicker('to')}>
                        <Text style={[styles.filterDateBtnText, !draftTimeTo && styles.filterPlaceholder]}>
                          {draftTimeTo || 'Select time'}
                        </Text>
                        <MCIcon name="clock-outline" size={18} color={colors.textMuted} />
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
                <MCIcon name="close-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.filterClearText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyBtn} onPress={applyFilters}>
                <MCIcon name="filter-check" size={18} color={colors.white} />
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
                if (calendarTarget === 'from') {
                  setDraftFromDate(d);
                  setDraftToDate(d);
                } else {
                  if (draftFromDate && d < draftFromDate) {
                    showAlert('Invalid', 'To date cannot be before from date');
                    return;
                  }
                  setDraftToDate(d);
                }
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

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  filterBtn: { padding: 6 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    marginHorizontal: 12, marginTop: 12, marginBottom: 4, borderRadius: 25,
    paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary, marginLeft: 8, padding: 0 },
  list: { paddingBottom: 24 },
  statsRow: { flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 8 },
  skeletonTabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  statusTabs: { paddingHorizontal: 16, marginBottom: 8 },
  statusTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surfaceMuted, marginRight: 8 },
  statusTabActive: { backgroundColor: colors.primary },
  statusTabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  statusTabTextActive: { color: colors.white },
  activeChipRow: { paddingHorizontal: 16, marginBottom: 8 },
  chip: { backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 6 },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  card: {
    backgroundColor: colors.card, borderRadius: 12, marginHorizontal: 16, marginBottom: 10,
    padding: 14, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  leaveDate: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexShrink: 0 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBody: { gap: 6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  cardValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  actionText: { fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: colors.textMuted },

  // Filter Modal
  filterModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterModalContainer: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', width: '100%', maxWidth: 640, alignSelf: 'center' },
  filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterModalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  filterModalBody: { padding: 20 },
  filterSectionLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  filterDateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  filterDateGroup: { flex: 1 },
  filterFieldLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  filterDateBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted,
    borderRadius: 8, paddingHorizontal: 12, height: 44, justifyContent: 'space-between',
  },
  filterDateBtnText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  filterPlaceholder: { color: colors.textMuted, fontWeight: '400' },
  filterDateSep: { fontSize: 16, fontWeight: '700', color: colors.textMuted, paddingBottom: 10 },
  filterQuickDates: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickDateBtn: { flex: 1, backgroundColor: colors.primaryLight, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quickDateBtnActive: { backgroundColor: colors.primary },
  quickDateText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  quickDateTextActive: { color: colors.white },
  partialDayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.borderStrong, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  partialDayLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  timeRangeSection: { marginTop: 16 },
  filterModalActions: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 },
  filterCancelBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.surfaceMuted },
  filterCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  filterClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.danger + '55' },
  filterClearText: { fontSize: 14, fontWeight: '600', color: colors.danger },
  filterApplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary },
  filterApplyText: { fontSize: 14, fontWeight: '700', color: colors.white },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNav: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
  calTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  calDayNames: { flexDirection: 'row', marginBottom: 8 },
  calDayNameText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: colors.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  calDaySelected: { backgroundColor: colors.primary, borderRadius: 20 },
  calDayNum: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  calDayNumSelected: { color: colors.white, fontWeight: '700' },
  calDayToday: { color: colors.primary, fontWeight: '700' },

  // Detail Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalContainer: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 560, alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4, paddingHorizontal: 20 },
  modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, paddingHorizontal: 20 },
  modalReason: { fontSize: 13, color: colors.textMuted, marginBottom: 16, fontStyle: 'italic', paddingHorizontal: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, paddingHorizontal: 20 },
  modalInput: { backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 12, fontSize: 14, color: colors.textPrimary, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, marginHorizontal: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, paddingHorizontal: 20, paddingBottom: 20 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalCancelBtn: { backgroundColor: colors.surfaceMuted },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: colors.white },
  detailStatusHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 20, gap: 14,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  detailStatusHeaderText: { flex: 1 },
  detailStatusHeaderLabel: { fontSize: 22, fontWeight: '800', color: colors.white },
  detailStatusHeaderDate: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },
  detailBody: { padding: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceMuted, justifyContent: 'center', alignItems: 'center' },
  detailCol: { flex: 1 },
  detailFieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  detailFieldValue: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  detailSlotText: { fontSize: 13, color: colors.textSecondary, marginTop: 2, fontWeight: '500' },
  detailReasonText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20, marginTop: 2 },
  detailDivider: { height: 1, backgroundColor: colors.surfaceMuted, marginVertical: 12 },
  closeDetailBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 20, marginBottom: 20 },
  closeDetailBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  footerLoader: { paddingVertical: 20 },

  // Calendar Modal styles
  calendarModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  calendarModalContainer: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  calendarModalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  calendarDoneBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  calendarDoneText: { color: colors.white, fontWeight: '700', fontSize: 15 },

});

export default DoctorLeaveManagementScreen;
