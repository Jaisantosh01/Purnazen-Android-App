import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';

const AppointmentManagementScreen = ({ navigation }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = () => {
    setLoading(true);
    apiClient
      .get(ENDPOINTS.APPOINTMENTS)
      .then(res => {
        setAppointments(res.data?.appointments || []);
      })
      .catch(() => Alert.alert('Error', 'Failed to fetch appointments'))
      .finally(() => setLoading(false));
  };

  const handleUpdateStatus = () => {
    if (!editingAppointment) return;
    apiClient
      .put(`${ENDPOINTS.APPOINTMENTS}/${editingAppointment.id}`, { status })
      .then(() => {
        Alert.alert('Success', 'Appointment updated');
        setEditingAppointment(null);
        fetchAppointments();
      })
      .catch(() => Alert.alert('Error', 'Failed to update'));
  };

  const renderAppointment = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.reference}>{item.reference}</Text>
        <Text style={[styles.status, { color: item.status === 'booked' ? COLORS.primary : item.status === 'completed' ? '#50C878' : '#FF4D4D' }]}>
            {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.doctorName}>{item.doctorName}</Text>
      <Text style={styles.details}>{item.date} | {item.visitType}</Text>
      
      <TouchableOpacity 
        style={styles.editBtn}
        onPress={() => {
            setEditingAppointment(item);
            setStatus(item.status);
        }}
      >
        <Text style={styles.editBtnText}>Update Status</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Appointments</Text>
      </View>

      <FlatList
        data={appointments}
        keyExtractor={item => item.id.toString()}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={fetchAppointments}
      />

      <Modal visible={!!editingAppointment} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Update Status</Text>
                {['booked', 'completed', 'cancelled'].map(s => (
                    <TouchableOpacity key={s} style={[styles.option, status === s && styles.selectedOption]} onPress={() => setStatus(s)}>
                        <Text style={status === s && styles.selectedOptionText}>{s}</Text>
                    </TouchableOpacity>
                ))}
                <View style={styles.actions}>
                    <TouchableOpacity style={[styles.btn, styles.cancel]} onPress={() => setEditingAppointment(null)}><Text>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.save]} onPress={handleUpdateStatus}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, padding: 20, backgroundColor: COLORS.white },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  listContainer: { padding: 16 },
  card: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  reference: { fontWeight: '700' },
  status: { fontWeight: '700' },
  doctorName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  details: { color: COLORS.textSecondary },
  editBtn: { marginTop: 12, backgroundColor: COLORS.primaryLight, padding: 10, borderRadius: 8, alignItems: 'center' },
  editBtnText: { color: COLORS.primary, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.white, padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  option: { padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  selectedOption: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  selectedOptionText: { color: COLORS.primary, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 15 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancel: { backgroundColor: '#eee' },
  save: { backgroundColor: COLORS.primary },
  saveText: { color: COLORS.white, fontWeight: 'bold' }
});

export default AppointmentManagementScreen;
