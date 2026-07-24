import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [filterModal, setFilterModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ specialties: [], expertises: [], languages: [] });
  const [selectedFilters, setSelectedFilters] = useState({ specialties: [], expertises: [], languages: [] });
  const [expandedSections, setExpandedSections] = useState({ specialties: true, expertises: true, languages: true });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    Promise.all([
      apiClient.get(ENDPOINTS.SPECIALTIES),
      apiClient.get(ENDPOINTS.EXPERTISES),
      apiClient.get(ENDPOINTS.LANGUAGES),
    ])
      .then(([sRes, eRes, lRes]) => {
        setFilterOptions({
          specialties: sRes?.data?.data || sRes?.data || [],
          expertises: eRes?.data?.data || eRes?.data || [],
          languages: lRes?.data?.data || lRes?.data || [],
        });
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback((pageNum = 1, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    const params = { page: pageNum, limit: 20 };
    if (debouncedSearch) params.search = debouncedSearch;

    Promise.all([
      apiClient.get(ENDPOINTS.DOCTORS, { params }),
      pageNum === 1 ? apiClient.get(ENDPOINTS.DOCTOR_STATS) : Promise.resolve(null),
    ])
      .then(([docRes, statsRes]) => {
        const newDoctors = docRes?.data?.data?.doctors || docRes?.data?.doctors || [];
        setDoctors(prev => append ? [...prev, ...newDoctors] : newDoctors);
        const total = docRes?.data?.data?.total || docRes?.data?.total || 0;
        const limit = docRes?.data?.data?.limit || docRes?.data?.limit || 20;
        setHasMore(pageNum * limit < total);
        setPage(pageNum);
        if (statsRes) {
          setStats(statsRes?.data || { active_doctors: 0, inactive_doctors: 0 });
        }
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        if (!append) setDoctors([]);
      })
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [debouncedSearch]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const isActiveFiltered = selectedFilters.specialties.length > 0 ||
    selectedFilters.expertises.length > 0 ||
    selectedFilters.languages.length > 0;

  const hasActiveFilters = statusFilter !== null || isActiveFiltered;

  const filteredDoctors = doctors.filter(doc => {
    if (statusFilter === 'active' && doc.is_active === false) return false;
    if (statusFilter === 'inactive' && doc.is_active !== false) return false;
    if (selectedFilters.specialties.length > 0) {
      const docSpecialties = (doc.specialties || []).map(s => typeof s === 'string' ? s.toLowerCase() : (s.name || s).toLowerCase());
      if (!selectedFilters.specialties.some(f => docSpecialties.includes(f.toLowerCase()))) return false;
    }
    if (selectedFilters.expertises.length > 0) {
      const docExpertise = (doc.expertise || []).map(e => typeof e === 'string' ? e.toLowerCase() : (e.name || e).toLowerCase());
      if (!selectedFilters.expertises.some(f => docExpertise.includes(f.toLowerCase()))) return false;
    }
    if (selectedFilters.languages.length > 0) {
      const docLangs = (doc.languages || []).map(l => typeof l === 'string' ? l.toLowerCase() : (l.name || l).toLowerCase());
      if (!selectedFilters.languages.some(f => docLangs.includes(f.toLowerCase()))) return false;
    }
    return true;
  });

  const toggleFilter = (category, value) => {
    setSelectedFilters(prev => {
      const current = prev[category];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  const getActiveFilterCount = () =>
    selectedFilters.specialties.length + selectedFilters.expertises.length + selectedFilters.languages.length;

  const clearFilters = () => {
    setSelectedFilters({ specialties: [], expertises: [], languages: [] });
  };

  const renderFilterSection = (title, icon, category, items) => {
    const isExpanded = expandedSections[category];
    const selectedCount = selectedFilters[category].length;
    return (
      <View style={styles.filterSection}>
        <TouchableOpacity style={styles.filterSectionHeader} onPress={() => setExpandedSections(prev => ({ ...prev, [category]: !prev[category] }))}>
          <View style={styles.filterSectionHeaderLeft}>
            <MCIcon name={icon} size={18} color={colors.primary} />
            <Text style={styles.filterSectionTitle}>{title}</Text>
          </View>
          <View style={styles.filterSectionHeaderRight}>
            {selectedCount > 0 && (
              <View style={styles.filterSectionBadge}>
                <Text style={styles.filterSectionBadgeText}>{selectedCount}</Text>
              </View>
            )}
            <MCIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.filterChips}>
            {items.map(item => {
              const name = item.name || item;
              const isSelected = selectedFilters[category].includes(name);
              return (
                <TouchableOpacity
                  key={item.id || name}
                  style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                  onPress={() => toggleFilter(category, name)}
                >
                  <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  const handleEdit = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    navigation.navigate('EditDoctor', { doctorId: item.id });
  };

  const handleDelete = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    Alert.alert('Deactivate Doctor', `Are you sure you want to deactivate ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: () => {
        apiClient.delete(ENDPOINTS.DOCTOR_DETAIL(item.id))
          .then(() => { showAlert('Success', `${item.name} has been deactivated`); fetchData(); })
          .catch((err) => { showAlert('Error', err.message || 'Failed to deactivate doctor'); });
      }},
    ]);
  };

  const renderDoctorItem = ({ item }) => {
    const specialties = item.specialties || [];
    const expertise = item.expertise || [];
    const isInactive = item.is_active === false;

    const displaySpecialties = specialties.map(s => typeof s === 'string' ? s : (s.name || s)).join(', ');
    const displayExpertise = (expertise || []).slice(0, 2).map(e => typeof e === 'string' ? e : (e.name || e));
    const hasMoreExpertise = (expertise || []).length > 2;

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          if (!isInactive) {
            navigation.navigate('DoctorDetail', { doctorId: item.id });
          }
        }}
      >
        <View style={[styles.doctorCard, isInactive && styles.doctorCardInactive]}>
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
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHiddenItem = (data, rowMap) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => handleEdit(data.item, rowMap)}>
        <MCIcon name="pencil" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => handleDelete(data.item, rowMap)}>
        <MCIcon name="delete" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchData(page + 1, true);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.statsRow}>
        <TouchableOpacity style={[styles.statCard, { borderColor: colors.primary }, statusFilter === 'active' && styles.statCardSelected]} onPress={() => setStatusFilter(prev => prev === 'active' ? null : 'active')}>
          {loading && filteredDoctors.length === 0 ? (
            <Text style={[styles.statValue, { color: colors.primary }]}>·</Text>
          ) : (
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.active_doctors}</Text>
          )}
          <Text style={styles.statLabel}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statCard, { borderColor: colors.danger }, statusFilter === 'inactive' && styles.statCardSelected]} onPress={() => setStatusFilter(prev => prev === 'inactive' ? null : 'inactive')}>
          {loading && filteredDoctors.length === 0 ? (
            <Text style={[styles.statValue, { color: colors.danger }]}>·</Text>
          ) : (
            <Text style={[styles.statValue, { color: colors.danger }]}>{stats.inactive_doctors}</Text>
          )}
          <Text style={styles.statLabel}>Inactive</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <MCIcon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput style={styles.searchInput} placeholder="Search by name..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterModal(true)}>
          <MCIcon name="filter-variant" size={22} color={hasActiveFilters ? colors.primary : colors.textMuted} />
          {getActiveFilterCount() > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {loading && filteredDoctors.length === 0 ? (
        <ListSkeleton count={5} />
      ) : (
        <SwipeListView
          data={filteredDoctors}
          keyExtractor={item => item.id.toString()}
          leftOpenValue={80}
          rightOpenValue={-80}
          renderItem={renderDoctorItem}
          renderHiddenItem={renderHiddenItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="doctor" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No doctors found</Text>
            </View>
          }
          refreshing={loading}
          onRefresh={() => fetchData(1)}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null}
          closeOnRowPress={true}
        />
      )}

      <Modal visible={filterModal} transparent animationType="slide" onRequestClose={() => setFilterModal(false)}>
        <View style={styles.filterOverlay}>
          <TouchableOpacity style={styles.filterOverlayBackdrop} onPress={() => setFilterModal(false)} activeOpacity={1} />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <View style={styles.filterSheetDrag} />
              <View style={styles.filterSheetTitleRow}>
                <Text style={styles.filterSheetTitle}>Filters</Text>
                {getActiveFilterCount() > 0 && (
                  <TouchableOpacity onPress={clearFilters}>
                    <Text style={styles.filterClearText}>Clear all</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView style={styles.filterSheetBody} showsVerticalScrollIndicator={false}>
              {renderFilterSection('Specialties', 'stethoscope', 'specialties', filterOptions.specialties)}
              {renderFilterSection('Expertise', 'lightbulb-on-outline', 'expertises', filterOptions.expertises)}
              {renderFilterSection('Languages', 'translate', 'languages', filterOptions.languages)}
            </ScrollView>
            <TouchableOpacity style={styles.filterApplyBtn} onPress={() => setFilterModal(false)}>
              <Text style={styles.filterApplyText}>Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 12 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, opacity: 1 },
  statCardSelected: { backgroundColor: colors.primaryLight, borderWidth: 2 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, gap: 8 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  filterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  filterBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.primary, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  listContainer: { paddingHorizontal: 16 },
  doctorCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  doctorInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  details: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  specialty: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2 },
  expertiseContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  expertiseTag: { backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  expertiseText: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  doctorCardInactive: { backgroundColor: colors.surfaceMuted},
  avatarInactive: { backgroundColor: colors.border },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textInactive: { color: colors.textMuted },
  tagInactive: { backgroundColor: colors.border },
  inactiveBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyText: { marginTop: 16, fontSize: 16, color: colors.textMuted },

  rowBack: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    width: 75,
    height: '100%',
  },
  editBack: { backgroundColor: '#3B82F6' },
  deleteBack: { backgroundColor: '#EF4444' },
  backBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },

  filterOverlay: { flex: 1, justifyContent: 'flex-end' },
  filterOverlayBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  filterSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  filterSheetHeader: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 4 },
  filterSheetDrag: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  filterSheetTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterSheetTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  filterClearText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  filterSheetBody: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  filterSection: { borderBottomWidth: 1, borderBottomColor: colors.border },
  filterSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  filterSectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterSectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  filterSectionBadge: { backgroundColor: colors.primary, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterSectionBadgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  filterSectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  filterChipTextSelected: { color: colors.white },
  filterApplyBtn: { margin: 20, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  filterApplyText: { fontSize: 16, fontWeight: '700', color: colors.white },
});