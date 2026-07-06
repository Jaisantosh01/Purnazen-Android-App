import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
import { ListSkeleton } from '../components/SkeletonLoader';

const DoctorManagementScreen = ({ navigation }) => {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({ active_doctors: 0, inactive_doctors: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuTarget, setMenuTarget] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

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

  const handleEdit = (item) => {
    navigation.navigate('EditDoctor', { doctorId: item.id });
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Deactivate Doctor',
      `Are you sure you want to deactivate ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => {
            apiClient.delete(ENDPOINTS.DOCTOR_DETAIL(item.id))
              .then(() => {
                Alert.alert('Success', `${item.name} has been deactivated`);
                fetchData();
              })
              .catch((err) => {
                Alert.alert('Error', err.message || 'Failed to deactivate doctor');
              });
          },
        },
      ]
    );
  };

  const renderDoctorItem = ({ item }) => {
    const specialties = item.specialties || [];
    const expertise = item.expertise || [];
    const isInactive = item.is_active === false;
    
    const displaySpecialties = specialties.join(', ');
    const displayExpertise = expertise.slice(0, 2);
    const hasMoreExpertise = expertise.length > 2;

    return (
      <TouchableOpacity
        activeOpacity={isInactive ? 1 : 0.7}
        onPress={() => {
          if (!isInactive) {
            navigation.navigate('DoctorDetail', { doctorId: item.id });
          }
        }}
      >
        <View style={[styles.doctorCard, isInactive && styles.doctorCardInactive, menuTarget?.id === item.id && { zIndex: 100 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.doctorInfo}>
              <View style={[styles.avatarPlaceholder, isInactive && styles.avatarInactive]}>
                <MCIcon name="account" size={32} color={isInactive ? COLORS.textMuted : COLORS.primary} />
              </View>
              <View style={styles.details}>
                <View style={styles.nameRow}>
                  <Text style={[styles.doctorName, isInactive && styles.textInactive]}>{item.name}</Text>
                  {isInactive && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.specialty, isInactive && styles.textInactive]} numberOfLines={1} ellipsizeMode="tail">
                  {displaySpecialties || 'N/A'}
                </Text>
                <View style={styles.expertiseContainer}>
                  {displayExpertise.map((expName, idx) => (
                    <View key={idx} style={[styles.expertiseTag, isInactive && styles.tagInactive]}>
                      <Text style={[styles.expertiseText, isInactive && styles.textInactive]}>{expName}</Text>
                    </View>
                  ))}
                  {hasMoreExpertise && (
                    <View style={[styles.expertiseTag, isInactive && styles.tagInactive]}>
                      <Text style={[styles.expertiseText, isInactive && styles.textInactive]}>...</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.actionBtns}>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setMenuTarget(menuTarget?.id === item.id ? null : item)}
              >
                <MCIcon name="dots-vertical" size={20} color={isInactive ? COLORS.textMuted : COLORS.textPrimary} />
              </TouchableOpacity>
              {menuTarget?.id === item.id && (
                <View style={styles.cardDropdown}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuTarget(null); handleEdit(item); }}>
                    <MCIcon name="pencil-outline" size={16} color={COLORS.textPrimary} />
                    <Text style={styles.menuItemText}>Edit</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuTarget(null); handleDelete(item); }}>
                    <MCIcon name="delete-outline" size={16} color={COLORS.danger} />
                    <Text style={[styles.menuItemText, { color: COLORS.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header removed as it is now in UnifiedUserDoctorScreen */}

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={() => menuTarget && setMenuTarget(null)}
        scrollEventThrottle={16}
      >
        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: COLORS.primary }]}>
            <Text style={[styles.statValue, { color: COLORS.primary }]}>{stats.active_doctors}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { borderColor: COLORS.danger }]}>
            <Text style={[styles.statValue, { color: COLORS.danger }]}>{stats.inactive_doctors}</Text>
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
            <ListSkeleton count={5} />
          ) : filteredDoctors.length > 0 ? (
            filteredDoctors.map(item => (
              <View key={item.id}>
                {renderDoctorItem({ item })}
              </View>
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
    paddingTop: 16,
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
  doctorCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'visible', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  doctorInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  details: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  specialty: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  expertiseContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  expertiseTag: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  expertiseText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  doctorCardInactive: { opacity: 0.6, backgroundColor: '#f5f5f5' },
  avatarInactive: { backgroundColor: '#e0e0e0' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textInactive: { color: COLORS.textMuted },
  tagInactive: { backgroundColor: '#e0e0e0' },
  inactiveBadge: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  actionBtns: { position: 'relative', marginLeft: 8, paddingTop: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: COLORS.textMuted },

  cardDropdown: {
    position: 'absolute',
    top: 22,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  menuDivider: { height: 1, backgroundColor: '#f0f0f0', marginHorizontal: 8 },
  menuItemText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
});
