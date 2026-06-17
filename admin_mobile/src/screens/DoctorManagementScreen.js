import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';

const DoctorManagementScreen = ({ navigation }) => {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({ active_doctors: 0, inactive_doctors: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiClient.get(ENDPOINTS.DOCTORS),
      apiClient.get(ENDPOINTS.DOCTOR_STATS),
    ])
      .then(([docRes, statsRes]) => {
        // Log to debug why list is empty
        console.log('Doctor API response:', docRes);
        // Adjust based on actual response structure if needed
        setDoctors(docRes?.data?.doctors || docRes?.data || []);
        setStats(statsRes?.data || { active_doctors: 0, inactive_doctors: 0 });
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setDoctors([]);
        setStats({ active_doctors: 0, inactive_doctors: 0 });
      })
      .finally(() => setLoading(false));
  };

  const filteredDoctors = doctors.filter(doc =>
    (doc.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (doc.specialty || '').toLowerCase().includes(search.toLowerCase())
  );

  const renderDoctorItem = ({ item }) => {
    const specialties = item.specialties || [];
    const expertise = item.expertise || [];
    
    // Display all specialties joined by comma
    const displaySpecialties = specialties.join(', ');
        
    // Display at most 2 expertise tags
    const displayExpertise = expertise.slice(0, 2);
    const hasMoreExpertise = expertise.length > 2;

    return (
        <View style={styles.doctorCard}>
        <View style={styles.doctorInfo}>
            <View style={styles.avatarPlaceholder}>
            <MCIcon name="account" size={32} color={COLORS.primary} />
            </View>
            <View style={styles.details}>
            <Text style={styles.doctorName}>{item.name}</Text>
            <Text style={styles.specialty} numberOfLines={1} ellipsizeMode="tail">{displaySpecialties || 'N/A'}</Text>
            <View style={styles.expertiseContainer}>
                {displayExpertise.map((expName, idx) => (
                <View key={idx} style={styles.expertiseTag}>
                    <Text style={styles.expertiseText}>{expName}</Text>
                </View>
                ))}
                {hasMoreExpertise && (
                    <View style={styles.expertiseTag}>
                        <Text style={styles.expertiseText}>...</Text>
                    </View>
                )}
            </View>
            </View>
            <MCIcon name="chevron-right" size={24} color={COLORS.textMuted} />
        </View>
        </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Doctor Management</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateDoctor')}
        >
          <MCIcon name="plus" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: '#50C878' }]}>
            <Text style={[styles.statValue, { color: '#50C878' }]}>{stats.active_doctors}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#FF4D4D' }]}>
            <Text style={[styles.statValue, { color: '#FF4D4D' }]}>{stats.inactive_doctors}</Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
        </View>

        {/* ── Management Options (Horizontal) ── */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.manageOptions}
          contentContainerStyle={styles.manageOptionsContent}
        >
          <TouchableOpacity 
            style={styles.optionBtn} 
            onPress={() => navigation.navigate('ManageExpertise', { title: 'Expertise', endpoint: ENDPOINTS.EXPERTISES })}
          >
            <Text style={styles.optionText}>Expertise</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.optionBtn} 
            onPress={() => navigation.navigate('ManageLanguages', { title: 'Languages', endpoint: ENDPOINTS.LANGUAGES })}
          >
            <Text style={styles.optionText}>Languages</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.optionBtn} 
            onPress={() => navigation.navigate('ManageSpecialties', { title: 'Specialties', endpoint: ENDPOINTS.SPECIALTIES })}
          >
            <Text style={styles.optionText}>Specialties</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* ── Search ── */}
        <View style={styles.searchContainer}>
          <MCIcon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or specialty..."
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* ── List ── */}
        <View style={styles.listContainer}>
          {loading ? (
            <Text style={styles.loadingText}>Loading doctors...</Text>
          ) : filteredDoctors.length > 0 ? (
            filteredDoctors.map(item => (
              <TouchableOpacity 
                key={item.id} 
                onPress={() => {
                  console.log('Doctor clicked:', item);
                  navigation.navigate('DoctorDetail', { doctorId: item.id });
                }}
              >
                {renderDoctorItem({ item })}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <MCIcon name="doctor" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No doctors found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default DoctorManagementScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  addBtn: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: '600' },
  searchContainer: { marginHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 12, height: 44, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  manageOptions: { marginBottom: 16 },
  manageOptionsContent: { paddingHorizontal: 16, gap: 8 },
  optionBtn: { backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
  optionText: { color: COLORS.primary, fontWeight: '600' },
  listContainer: { paddingHorizontal: 16 },
  doctorCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  doctorInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  details: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  specialty: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  expertiseContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  expertiseTag: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  expertiseText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  loadingText: { textAlign: 'center', marginTop: 40, color: COLORS.textMuted },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: COLORS.textMuted },
});
