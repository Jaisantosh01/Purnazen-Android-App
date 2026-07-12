import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ListSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';

const DoctorManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    showAlert(
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
                showAlert('Success', `${item.name} has been deactivated`);
                fetchData();
              })
              .catch((err) => {
                showAlert('Error', err.message || 'Failed to deactivate doctor');
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
                <MCIcon name="account-cancel" size={28} color={isInactive ? colors.white : colors.primary} />
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
                <MCIcon name="dots-vertical" size={20} color={isInactive ? colors.textMuted : colors.textPrimary} />
              </TouchableOpacity>
              {menuTarget?.id === item.id && (
                <View style={styles.cardDropdown}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuTarget(null); handleEdit(item); }}>
                    <MCIcon name="pencil-outline" size={16} color={colors.textPrimary} />
                    <Text style={styles.menuItemText}>Edit</Text>
                  </TouchableOpacity>
                  <View style={styles.menuDivider} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuTarget(null); handleDelete(item); }}>
                    <MCIcon name="delete-outline" size={16} color={colors.danger} />
                    <Text style={[styles.menuItemText, { color: colors.danger }]}>Delete</Text>
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
      
      {/* Header removed as it is now in UnifiedUserDoctorScreen */}

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={() => menuTarget && setMenuTarget(null)}
        scrollEventThrottle={16}
      >
        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: colors.primary }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.active_doctors}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.danger }]}>
            <Text style={[styles.statValue, { color: colors.danger }]}>{stats.inactive_doctors}</Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
        </View>

        {/* ── Search ── */}
        <View style={styles.searchContainer}>
          <MCIcon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
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
              <MCIcon name="doctor" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No doctors found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default DoctorManagementScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  addBtn: { backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  searchContainer: { marginHorizontal: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, height: 44, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  listContainer: { paddingHorizontal: 16 },
  doctorCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'visible', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  doctorInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  details: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  specialty: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  expertiseContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  expertiseTag: { backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  expertiseText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  doctorCardInactive: { backgroundColor: '#FEF2F2', overflow: 'hidden' },

  avatarInactive: { backgroundColor: '#FCA5A5' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textInactive: { color: '#9CA3AF' },
  tagInactive: { backgroundColor: '#FEE2E2' },
  inactiveBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  actionBtns: { position: 'relative', marginLeft: 8, paddingTop: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: colors.textMuted },

  cardDropdown: {
    position: 'absolute',
    top: 22,
    right: 0,
    backgroundColor: colors.white,
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
  menuDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 8 },
  menuItemText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
});
