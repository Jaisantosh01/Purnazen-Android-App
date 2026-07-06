import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
<<<<<<< HEAD
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import patientService from '../services/patientService';
=======
import appointmentService from '../services/appointmentService';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f

const FILTER_CHIPS = ['All', 'Male', 'Female', 'Recent'];

// ─── Patient Card Component ───────────────────────────────────────────────────
const PatientCard = ({ item, onPress }) => {
  const initials = item.name
    ? item.name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => onPress(item)}>
      
      {/* Circular Avatar */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Patient details */}
      <View style={styles.cardBody}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardMeta}>{item.gender} • {item.ageStr || `${item.age} Years`}</Text>
        
        <Text style={styles.consultationsCount}>{item.totalConsultations} Consultations</Text>
        
        <View style={styles.lastVisitSection}>
          <Text style={styles.lastVisitLabel}>Last Visit:</Text>
          <Text style={styles.lastVisitValue}>{item.lastVisit}</Text>
        </View>
      </View>

      {/* Right chevron icon */}
      <View style={styles.chevronWrap}>
        <MCIcon name="chevron-right" size={24} color={COLORS.textMuted} />
      </View>

    </TouchableOpacity>
  );
};

const PatientSeparator = () => <View style={styles.separator} />;

// ─── Main Screen ───────────────────────────────────────────────────────────────
const PatientsScreen = ({ navigation }) => {
<<<<<<< HEAD
  const [patients, setPatients] = useState([]);
=======
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [appointments, setAppointments] = useState([]);
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');

  const fetchPatients = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await patientService.list();
      setPatients(data);
    } catch (err) {
      setError(err?.message || 'Failed to load patients. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

<<<<<<< HEAD
  useEffect(() => {
    fetchPatients();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatients(false);
  };

  // Filter patients based on search and active chip filter
  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const name = patient.name || '';
      const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesFilter = true;
      if (selectedFilter === 'Male') {
        matchesFilter = patient.gender === 'Male';
      } else if (selectedFilter === 'Female') {
        matchesFilter = patient.gender === 'Female';
      } else if (selectedFilter === 'Recent') {
        matchesFilter = patient.isRecent;
      }
      
      return matchesSearch && matchesFilter;
    });
  }, [patients, searchQuery, selectedFilter]);

  const handlePatientPress = (patient) => {
    navigation.navigate('PatientProfile', { patientId: patient.id });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader title="Patients" />

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <MCIcon name="magnify" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MCIcon name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
=======
  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openPatient(item)}>
      <View style={styles.avatar}>
        <MCIcon name="account" size={28} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.email || item.phone || 'No contact'}
        </Text>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <MCIcon name="calendar-check" size={11} color={colors.textSecondary} />
            <Text style={styles.pillText}>{item.visits} visit{item.visits === 1 ? '' : 's'}</Text>
          </View>
          <View style={styles.pill}>
            <MCIcon name="history" size={11} color={colors.textSecondary} />
            <Text style={styles.pillText}>Last {formatDate(item.lastDate)}</Text>
          </View>
        </View>
      </View>
      <MCIcon name="chevron-right" size={22} color={colors.borderStrong} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Patients"
        right={
          <TouchableOpacity onPress={onRefresh}>
            <MCIcon name="refresh" size={22} color={colors.white} />
          </TouchableOpacity>
        }
      />

      {/* Search */}
      <View style={styles.searchWrap}>
        <MCIcon name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MCIcon name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f
      </View>

      {/* Filter Chips */}
      <View style={styles.filterStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          keyboardShouldPersistTaps="handled">
          {FILTER_CHIPS.map(filter => {
            const isActive = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.chip, isActive && styles.chipActive]}
                activeOpacity={0.8}
                onPress={() => setSelectedFilter(filter)}>
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List content states */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
<<<<<<< HEAD
          <MCIcon name="alert-circle-outline" size={48} color={COLORS.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPatients()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
=======
          <MCIcon name="account-search-outline" size={60} color={colors.border} />
          <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No patients yet'}</Text>
          <Text style={styles.emptySubtitle}>
            {query
              ? 'No patients match your search.'
              : 'Patients appear here once you have appointments with them.'}
          </Text>
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f
        </View>
      ) : (
        <FlatList
          data={filteredPatients}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PatientCard item={item} onPress={handlePatientPress} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
<<<<<<< HEAD
          ItemSeparatorComponent={PatientSeparator}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="account-search-outline" size={60} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No Patients Found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search query or filters.
              </Text>
            </View>
          }
=======
          ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f
        />
      )}
    </View>
  );
};

export default PatientsScreen;

<<<<<<< HEAD
// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
=======
const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f

  // Search Bar
  searchBarContainer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
<<<<<<< HEAD
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 42,
  },
  searchIcon: { marginRight: SPACING.xs },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 0,
    fontWeight: '500',
  },
  clearBtn: { padding: 4 },
=======
    gap: SPACING.sm,
    backgroundColor: colors.card,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: colors.textPrimary },
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f

  // Filter Chips
  filterStrip: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterScroll: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    gap: SPACING.sm,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },

  // List & Cards
  list: { padding: SPACING.lg, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
<<<<<<< HEAD
    backgroundColor: COLORS.white,
=======
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: colors.card,
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
<<<<<<< HEAD
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    flex: 1,
    marginLeft: SPACING.md,
    gap: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  cardMeta: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },
  consultationsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 4,
  },
  lastVisitSection: {
    marginTop: 6,
  },
  lastVisitLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  lastVisitValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  chevronWrap: {
    paddingLeft: SPACING.xs,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  separator: {
    height: SPACING.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 14.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
=======
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  meta: { fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  pillRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 6, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
>>>>>>> 2475491f2ce0dfc5c254128f44bb58829c60db6f
});
