import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
import { ListSkeleton } from '../components/SkeletonLoader';

const STATUS_OPTIONS = ['pending', 'booked', 'completed', 'cancelled'];
const STATUS_COLORS = {
  pending: '#F59E0B',
  booked: '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
};
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CalendarPicker = ({ value, onSelect, onClose }) => {
  const today = new Date();
  const initial = value ? new Date(value) : today;
  const [viewMonth, setViewMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const fmt = (d) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.calNav}>
          <MCIcon name="chevron-left" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.calTitle}>{MONTH_NAMES[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.calNav}>
          <MCIcon name="chevron-right" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.calDayNames}>
        {DAY_NAMES.map(d => <Text key={d} style={styles.calDayName}>{d}</Text>)}
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
              onPress={() => { onSelect(ds); onClose(); }}
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

const AppointmentManagementScreen = ({ navigation, route }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consultationTypes, setConsultationTypes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [calendarMode, setCalendarMode] = useState(null);
  const [searchText, setSearchText] = useState('');

  const [appliedDocNames, setAppliedDocNames] = useState([]);
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [appliedTimeFrom, setAppliedTimeFrom] = useState('');
  const [appliedTimeTo, setAppliedTimeTo] = useState('');
  const [appliedStatus, setAppliedStatus] = useState([]);

  const [draftDocNames, setDraftDocNames] = useState([]);
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [draftTimeFrom, setDraftTimeFrom] = useState('');
  const [draftTimeTo, setDraftTimeTo] = useState('');
  const [draftStatus, setDraftStatus] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState('');

  useEffect(() => {
    fetchAppointments();
    fetchConsultationTypes();
  }, []);

  useEffect(() => {
    if (route?.params?.filterDate) {
      setAppliedDateFrom(route.params.filterDate);
      setAppliedDateTo(route.params.filterDate);
    }
  }, [route?.params?.filterDate]);

  const fetchAppointments = useCallback(() => {
    setLoading(true);
    apiClient
      .get(ENDPOINTS.APPOINTMENTS_ADMIN)
      .then(res => setAppointments(res.data?.appointments || []))
      .catch(() => Alert.alert('Error', 'Failed to fetch appointments'))
      .finally(() => setLoading(false));
  }, []);

  const fetchConsultationTypes = () => {
    apiClient
      .get(ENDPOINTS.CONSULTATION_TYPES)
      .then(res => setConsultationTypes(res.data || []))
      .catch(() => {});
  };

  const uniqueDoctors = useMemo(() => {
    const names = new Set();
    appointments.forEach(a => { if (a.doctorName) names.add(a.doctorName); });
    return Array.from(names).sort();
  }, [appointments]);

  const filteredDoctors = useMemo(() => {
    if (!doctorSearch) return uniqueDoctors;
    return uniqueDoctors.filter(d => d.toLowerCase().includes(doctorSearch.toLowerCase()));
  }, [uniqueDoctors, doctorSearch]);

  const displayedDoctors = useMemo(() => {
    if (doctorSearch) return filteredDoctors;
    return filteredDoctors.slice(0, 3);
  }, [filteredDoctors, doctorSearch]);
  const hasMoreDoctors = !doctorSearch && uniqueDoctors.length > 3;

  const openFilterModal = () => {
    setDraftDocNames([...appliedDocNames]);
    setDraftDateFrom(appliedDateFrom);
    setDraftDateTo(appliedDateTo);
    setDraftTimeFrom(appliedTimeFrom);
    setDraftTimeTo(appliedTimeTo);
    setDraftStatus([...appliedStatus]);
    setDoctorSearch('');
    setFilterModalVisible(true);
  };

  const applyFilters = () => {
    setAppliedDocNames([...draftDocNames]);
    setAppliedDateFrom(draftDateFrom);
    setAppliedDateTo(draftDateTo);
    setAppliedTimeFrom(draftTimeFrom);
    setAppliedTimeTo(draftTimeTo);
    setAppliedStatus([...draftStatus]);
    setFilterModalVisible(false);
  };

  const clearFilters = () => {
    setDraftDocNames([]);
    setDraftDateFrom('');
    setDraftDateTo('');
    setDraftTimeFrom('');
    setDraftTimeTo('');
    setDraftStatus([]);
  };

  const cancelFilters = () => {
    setFilterModalVisible(false);
  };

  const toggleDraftDoctor = (name) => {
    setDraftDocNames(prev =>
      prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]
    );
  };

  const toggleDraftStatus = (s) => {
    setDraftStatus(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const hasAppliedFilters = appliedDocNames.length > 0 || appliedDateFrom || appliedDateTo || appliedTimeFrom || appliedTimeTo || appliedStatus.length > 0;
  const activeFilterCount = [appliedDocNames.length > 0, appliedDateFrom || appliedDateTo, appliedTimeFrom || appliedTimeTo, appliedStatus.length > 0].filter(Boolean).length;

  const hasDraftFilters = draftDocNames.length > 0 || draftDateFrom || draftDateTo || draftTimeFrom || draftTimeTo || draftStatus.length > 0;

  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (activeFilter !== 'All' && a.consultationType !== activeFilter) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        const ref = (a.reference || '').toLowerCase();
        const doc = (a.doctorName || '').toLowerCase();
        const pat = (a.userName || '').toLowerCase();
        if (!ref.includes(q) && !doc.includes(q) && !pat.includes(q)) return false;
      }
      if (appliedDocNames.length > 0 && !appliedDocNames.includes(a.doctorName)) return false;
      if (appliedDateFrom && a.date < appliedDateFrom) return false;
      if (appliedDateTo && a.date > appliedDateTo) return false;
      if (appliedTimeFrom && a.time && a.time < appliedTimeFrom) return false;
      if (appliedTimeTo && a.time && a.time > appliedTimeTo) return false;
      if (appliedStatus.length > 0 && !appliedStatus.includes(a.status)) return false;
      return true;
    });
  }, [appointments, activeFilter, searchText, appliedDocNames, appliedDateFrom, appliedDateTo, appliedTimeFrom, appliedTimeTo, appliedStatus]);

  const renderFilterTab = (label) => (
    <TouchableOpacity
      key={label}
      style={[styles.filterTab, activeFilter === label && styles.activeFilterTab]}
      onPress={() => setActiveFilter(label)}
    >
      <Text style={[styles.filterTabText, activeFilter === label && styles.activeFilterTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderAppointment = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelectedAppointment(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.reference}>{item.reference}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] || '#999') + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] || '#999' }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <MCIcon name="doctor" size={16} color={COLORS.primary} style={styles.rowIcon} />
          <Text style={styles.doctorName} numberOfLines={1}>{item.doctorName}</Text>
        </View>
        <View style={styles.cardRow}>
          <MCIcon name="account" size={16} color={COLORS.accent} style={styles.rowIcon} />
          <Text style={styles.patientName} numberOfLines={1}>{item.userName || 'Unknown'}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          <MCIcon name="calendar" size={14} color={COLORS.textMuted} />
          <Text style={styles.footerText}>{item.date}</Text>
          <MCIcon name="clock-outline" size={14} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
          <Text style={styles.footerText}>{item.time}</Text>
        </View>
        {item.fee != null && <Text style={styles.feeText}>₹{item.fee}</Text>}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Appointments</Text>
          <TouchableOpacity
            style={[styles.filterToggle, hasAppliedFilters && styles.filterToggleActive]}
            onPress={openFilterModal}
          >
            <MCIcon name="filter-variant" size={20} color={hasAppliedFilters ? COLORS.white : COLORS.textSecondary} />
            {hasAppliedFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <MCIcon name="magnify" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by reference, doctor or patient name..."
            placeholderTextColor={COLORS.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MCIcon name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderFilterTab('All')}
            {consultationTypes.map(renderFilterTab)}
          </ScrollView>
        </View>

        {hasAppliedFilters && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activeFilterChips}>
            {appliedDocNames.length > 0 && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{appliedDocNames.length} doctor{appliedDocNames.length > 1 ? 's' : ''}</Text>
              </View>
            )}
            {(appliedDateFrom || appliedDateTo) && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{appliedDateFrom || '...'} - {appliedDateTo || '...'}</Text>
              </View>
            )}
            {(appliedTimeFrom || appliedTimeTo) && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{appliedTimeFrom || '...'} - {appliedTimeTo || '...'}</Text>
              </View>
            )}
            {appliedStatus.length > 0 && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>{appliedStatus.length} status</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>

      {loading && filteredAppointments.length === 0 ? (
        <ListSkeleton count={5} />
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={item => item.id.toString()}
          renderItem={renderAppointment}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={fetchAppointments}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="calendar-remove" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No appointments found</Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={filterModalVisible} transparent animationType="slide">
        <View style={styles.filterModalOverlay}>
          <View style={styles.filterModalContainer}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filters</Text>
              <TouchableOpacity onPress={cancelFilters}>
                <MCIcon name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterModalBody} showsVerticalScrollIndicator={false}>
              {/* Doctors */}
              <Text style={styles.filterSectionLabel}>Doctors</Text>
              <View style={styles.doctorSearchRow}>
                <MCIcon name="magnify" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.doctorSearchInput}
                  placeholder="Search doctors..."
                  placeholderTextColor={COLORS.textMuted}
                  value={doctorSearch}
                  onChangeText={setDoctorSearch}
                />
                {doctorSearch ? (
                  <TouchableOpacity onPress={() => setDoctorSearch('')}>
                    <MCIcon name="close-circle" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {draftDocNames.length > 0 && (
                <View style={styles.selectedCountRow}>
                  <Text style={styles.selectedCountText}>{draftDocNames.length} selected</Text>
                  <TouchableOpacity onPress={() => setDraftDocNames([])}>
                    <Text style={styles.clearSmallText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.doctorList}>
                {displayedDoctors.map(name => {
                  const selected = draftDocNames.includes(name);
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.doctorItem, selected && styles.doctorItemSelected]}
                      onPress={() => toggleDraftDoctor(name)}
                    >
                      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
                        {selected && <MCIcon name="check" size={14} color={COLORS.white} />}
                      </View>
                      <MCIcon name="doctor" size={18} color={selected ? COLORS.white : COLORS.primary} style={{ marginHorizontal: 8 }} />
                      <Text style={[styles.doctorItemText, selected && styles.doctorItemTextSelected]}>{name}</Text>
                    </TouchableOpacity>
                  );
                })}
                {hasMoreDoctors && (
                  <TouchableOpacity style={styles.showMoreBtn} onPress={() => setDoctorSearch(' ')}>
                    <MCIcon name="chevron-double-down" size={16} color={COLORS.primary} />
                    <Text style={styles.showMoreText}>Show all {uniqueDoctors.length} doctors</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Date Range */}
              <Text style={[styles.filterSectionLabel, { marginTop: 20 }]}>Date Range</Text>
              <View style={styles.rangeRow}>
                <View style={styles.rangeInputGroup}>
                  <Text style={styles.rangeLabel}>From</Text>
                  <TouchableOpacity style={styles.dateBtn} onPress={() => setCalendarMode('from')}>
                    <MCIcon name="calendar-month" size={18} color={COLORS.primary} />
                    <Text style={[styles.dateBtnText, !draftDateFrom && styles.dateBtnPlaceholder]}>
                      {draftDateFrom || 'Select date'}
                    </Text>
                    {draftDateFrom ? (
                      <TouchableOpacity onPress={() => setDraftDateFrom('')}>
                        <MCIcon name="close-circle" size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    ) : (
                      <MCIcon name="chevron-down" size={16} color={COLORS.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.rangeSep}>-</Text>
                <View style={styles.rangeInputGroup}>
                  <Text style={styles.rangeLabel}>To</Text>
                  <TouchableOpacity style={styles.dateBtn} onPress={() => setCalendarMode('to')}>
                    <MCIcon name="calendar-month" size={18} color={COLORS.primary} />
                    <Text style={[styles.dateBtnText, !draftDateTo && styles.dateBtnPlaceholder]}>
                      {draftDateTo || 'Select date'}
                    </Text>
                    {draftDateTo ? (
                      <TouchableOpacity onPress={() => setDraftDateTo('')}>
                        <MCIcon name="close-circle" size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    ) : (
                      <MCIcon name="chevron-down" size={16} color={COLORS.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Time Range */}
              <Text style={[styles.filterSectionLabel, { marginTop: 20 }]}>Time Slot</Text>
              <View style={styles.rangeRow}>
                <View style={styles.rangeInputGroup}>
                  <Text style={styles.rangeLabel}>From</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="HH:MM AM"
                    placeholderTextColor={COLORS.textMuted}
                    value={draftTimeFrom}
                    onChangeText={setDraftTimeFrom}
                  />
                </View>
                <Text style={styles.rangeSep}>-</Text>
                <View style={styles.rangeInputGroup}>
                  <Text style={styles.rangeLabel}>To</Text>
                  <TextInput
                    style={styles.rangeInput}
                    placeholder="HH:MM AM"
                    placeholderTextColor={COLORS.textMuted}
                    value={draftTimeTo}
                    onChangeText={setDraftTimeTo}
                  />
                </View>
              </View>

              {/* Status */}
              <Text style={[styles.filterSectionLabel, { marginTop: 20 }]}>Appointment Status</Text>
              <View style={styles.statusGrid}>
                {STATUS_OPTIONS.map(s => {
                  const selected = draftStatus.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.statusCard, selected && { backgroundColor: (STATUS_COLORS[s] || '#999') + '15', borderColor: STATUS_COLORS[s] || '#999' }]}
                      onPress={() => toggleDraftStatus(s)}
                    >
                      <View style={[styles.radioOuter, selected && { borderColor: STATUS_COLORS[s] }]}>
                        {selected && <View style={[styles.radioInner, { backgroundColor: STATUS_COLORS[s] }]} />}
                      </View>
                      <View style={[styles.statusColorDot, { backgroundColor: STATUS_COLORS[s] || '#999' }]} />
                      <Text style={[styles.statusCardText, selected && { color: STATUS_COLORS[s] }]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.filterModalActions}>
              <TouchableOpacity style={styles.cancelActionBtn} onPress={cancelFilters}>
                <Text style={styles.cancelActionText}>Cancel</Text>
              </TouchableOpacity>
              {hasDraftFilters && (
                <TouchableOpacity style={styles.clearActionBtn} onPress={clearFilters}>
                  <MCIcon name="close-circle-outline" size={18} color={COLORS.danger} />
                  <Text style={styles.clearActionText}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.applyActionBtn} onPress={applyFilters}>
                <MCIcon name="filter-check" size={18} color={COLORS.white} />
                <Text style={styles.applyActionText}>Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Calendar Modal */}
      <Modal visible={!!calendarMode} transparent animationType="fade">
        <TouchableOpacity style={styles.calOverlay} activeOpacity={1} onPress={() => setCalendarMode(null)}>
          <View style={styles.calModal}>
            <View style={styles.calModalHeader}>
              <Text style={styles.calModalTitle}>Select {calendarMode === 'from' ? 'From' : 'To'} Date</Text>
              <TouchableOpacity onPress={() => setCalendarMode(null)}>
                <MCIcon name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <CalendarPicker
              value={calendarMode === 'from' ? draftDateFrom : draftDateTo}
              onSelect={(d) => {
                if (calendarMode === 'from') setDraftDateFrom(d);
                else setDraftDateTo(d);
              }}
              onClose={() => setCalendarMode(null)}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selectedAppointment} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Appointment Details</Text>
                <TouchableOpacity onPress={() => setSelectedAppointment(null)}>
                  <MCIcon name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              {selectedAppointment && (
                <>
                  <View style={styles.detailRefRow}>
                    <Text style={styles.detailRef}>{selectedAppointment.reference}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selectedAppointment.status] || '#999') + '20' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[selectedAppointment.status] || '#999' }]}>
                        {selectedAppointment.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Doctor</Text>
                    <View style={styles.detailRow}>
                      <MCIcon name="doctor" size={18} color={COLORS.primary} style={styles.detailIcon} />
                      <View>
                        <Text style={styles.detailValue}>{selectedAppointment.doctorName}</Text>
                        <Text style={styles.detailSub}>{selectedAppointment.specialty}</Text>
                      </View>
                    </View>
                    {selectedAppointment.doctorAbout ? (
                      <Text style={styles.detailDesc}>{selectedAppointment.doctorAbout}</Text>
                    ) : null}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Patient</Text>
                    <View style={styles.detailRow}>
                      <MCIcon name="account" size={18} color={COLORS.accent} style={styles.detailIcon} />
                      <Text style={styles.detailValue}>{selectedAppointment.userName || 'Unknown'}</Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Appointment Info</Text>
                    <View style={styles.detailGrid}>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailLabel}>Type</Text>
                        <Text style={styles.detailValue}>{selectedAppointment.consultationType}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailLabel}>Date</Text>
                        <Text style={styles.detailValue}>{selectedAppointment.date}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailLabel}>Day</Text>
                        <Text style={styles.detailValue}>{selectedAppointment.day}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailLabel}>Time</Text>
                        <Text style={styles.detailValue}>{selectedAppointment.time} - {selectedAppointment.endTime}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailLabel}>Fee</Text>
                        <Text style={styles.detailValue}>{selectedAppointment.fee != null ? `₹${selectedAppointment.fee}` : '—'}</Text>
                      </View>
                      <View style={styles.detailGridItem}>
                        <Text style={styles.detailLabel}>Payment</Text>
                        <Text style={[styles.detailValue, { color: selectedAppointment.paymentStatus === 'paid' ? '#10B981' : '#F59E0B' }]}>
                          {(selectedAppointment.paymentStatus || '—').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {selectedAppointment.userDescription ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Patient Description</Text>
                      <Text style={styles.detailDesc}>{selectedAppointment.userDescription}</Text>
                    </View>
                  ) : null}

                  {selectedAppointment.doctorDescription ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailSectionTitle}>Doctor Description</Text>
                      <Text style={styles.detailDesc}>{selectedAppointment.doctorDescription}</Text>
                    </View>
                  ) : null}
                </>
              )}

              <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedAppointment(null)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 12, padding: 20, backgroundColor: COLORS.white, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  filterToggle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, justifyContent: 'center', alignItems: 'center' },
  filterToggleActive: { backgroundColor: COLORS.primary },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center' },
  filterBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  searchSection: { backgroundColor: COLORS.white, paddingTop: 4, paddingBottom: 12 },
  activeFilterChips: { paddingHorizontal: 16 },
  activeChip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 6 },
  activeChipText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 8, borderRadius: 25, paddingHorizontal: 16, height: 44, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, padding: 0, marginLeft: 8 },
  filterRow: { paddingBottom: 10, paddingHorizontal: 16 },
  filterTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceMuted, marginRight: 8 },
  activeFilterTab: { backgroundColor: COLORS.primary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  activeFilterTabText: { color: COLORS.white },
  listContainer: { padding: 16, flexGrow: 1 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, marginBottom: 12, padding: 14, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reference: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBody: { gap: 6, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  rowIcon: { marginRight: 8 },
  doctorName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  patientName: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8 },
  footerLeft: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 12, color: COLORS.textMuted, marginLeft: 4 },
  feeText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 15, color: COLORS.textMuted },
  filterModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  filterModalContainer: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  filterModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  filterModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  filterModalBody: { padding: 20 },
  filterSectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  doctorSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceMuted, borderRadius: 10, paddingHorizontal: 12, height: 40 },
  doctorSearchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, padding: 0, marginLeft: 8 },
  selectedCountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 4 },
  selectedCountText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  clearSmallText: { fontSize: 12, fontWeight: '600', color: COLORS.danger },
  doctorList: { maxHeight: 160 },
  doctorItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, marginBottom: 4 },
  doctorItemSelected: { backgroundColor: COLORS.primary },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.borderStrong, justifyContent: 'center', alignItems: 'center' },
  checkCircleSelected: { borderColor: COLORS.white, backgroundColor: 'transparent' },
  doctorItemText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary, flex: 1 },
  doctorItemTextSelected: { color: COLORS.white },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  showMoreText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  rangeRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rangeInputGroup: { flex: 1 },
  rangeLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4 },
  rangeInput: { backgroundColor: COLORS.surfaceMuted, borderRadius: 8, paddingHorizontal: 12, height: 40, fontSize: 14, color: COLORS.textPrimary },
  rangeSep: { marginHorizontal: 10, fontSize: 16, fontWeight: '700', color: COLORS.textMuted, paddingBottom: 10 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceMuted, borderRadius: 8, paddingHorizontal: 10, height: 40, gap: 6 },
  dateBtnText: { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  dateBtnPlaceholder: { color: COLORS.textMuted, fontWeight: '400' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, width: '47%' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.borderStrong, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  statusColorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  statusCardText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  filterModalActions: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 10 },
  cancelActionBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, backgroundColor: COLORS.surfaceMuted },
  cancelActionText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  clearActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' },
  clearActionText: { fontSize: 14, fontWeight: '600', color: COLORS.danger },
  applyActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center', paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primary },
  applyActionText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  calOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 30 },
  calModal: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  calModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calModalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  calendarContainer: {},
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNav: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, justifyContent: 'center', alignItems: 'center' },
  calTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  calDayNames: { flexDirection: 'row', marginBottom: 8 },
  calDayName: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  calDaySelected: { backgroundColor: COLORS.primary, borderRadius: 20 },
  calDayNum: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  calDayNumSelected: { color: COLORS.white, fontWeight: '700' },
  calDayToday: { color: COLORS.primary, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center' },
  modalScrollContent: { padding: 20, flexGrow: 1, justifyContent: 'center' },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  detailRefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailRef: { fontSize: 14, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  detailSection: { marginBottom: 16 },
  detailSectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { marginRight: 10, width: 24 },
  detailValue: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  detailSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 1 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailGridItem: { width: '46%' },
  detailLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 2 },
  detailDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginTop: 4, backgroundColor: '#F9F9F9', padding: 10, borderRadius: 8 },
  closeBtn: { backgroundColor: COLORS.primary, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  closeBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});

export default AppointmentManagementScreen;
