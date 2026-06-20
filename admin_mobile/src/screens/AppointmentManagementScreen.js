import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';

const STATUS_COLORS = {
  pending: '#F59E0B',
  booked: '#3B82F6',
  completed: '#10B981',
  cancelled: '#EF4444',
};

const AppointmentManagementScreen = ({ navigation }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [consultationTypes, setConsultationTypes] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    fetchAppointments();
    fetchConsultationTypes();
  }, []);

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

  const filteredAppointments = activeFilter === 'All'
    ? appointments
    : appointments.filter(a => a.consultationType === activeFilter);

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
        <Text style={styles.headerTitle}>Appointments</Text>
      </View>

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterTab('All')}
          {consultationTypes.map(renderFilterTab)}
        </ScrollView>
      </View>

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
  header: { paddingTop: 56, padding: 20, backgroundColor: COLORS.white },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  filterRow: { backgroundColor: COLORS.white, paddingBottom: 12, paddingHorizontal: 16 },
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
