import React, { useState, useCallback, useMemo, useRef } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import patientService from '../services/patientService';

const FILTER_CHIPS = ['All', 'Male', 'Female', 'Others', 'Recent'];

// ─── Patient Card Component ───────────────────────────────────────────────────
const PatientCard = ({ item, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        <MCIcon name="chevron-right" size={24} color={colors.textMuted} />
      </View>

    </TouchableOpacity>
  );
};

const PatientSeparator = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.separator} />;
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
const PatientsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [patients, setPatients] = useState([]);
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
      // Show friendly copy, never the raw axios/API text (e.g. "Request failed
      // with status 404") which looked like a leaked API message on screen.
      console.warn('[PatientsScreen] load error:', err?.message);
      setError('We couldn’t load your patients right now. Pull down to refresh or try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // First focus shows the loader; later focuses refresh silently so the list
  // stays fresh without flashing when coming back from a patient detail.
  const hasFetchedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      fetchPatients(!hasFetchedRef.current);
      hasFetchedRef.current = true;
    }, []),
  );

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
      } else if (selectedFilter === 'Others') {
        matchesFilter = patient.gender === 'Other' || patient.gender === 'Others' || (patient.gender && patient.gender.toLowerCase() === 'other') || (patient.gender && patient.gender.toLowerCase() === 'others');
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
      <ScreenHeader title="Patients" showBack={false} underColor={colors.card} />

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <MCIcon name="magnify" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
            placeholderTextColor={colors.textMuted}
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
              <MCIcon name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
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
          <MCIcon name="alert-circle-outline" size={48} color={colors.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPatients()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
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
          ItemSeparatorComponent={PatientSeparator}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="account-search-outline" size={60} color={colors.borderStrong} />
              <Text style={styles.emptyTitle}>No Patients Found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search query or filters.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default PatientsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = colors =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Search Bar
  searchBarContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 42,
  },
  searchIcon: { marginRight: SPACING.xs },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    paddingVertical: 0,
    fontWeight: '500',
  },
  clearBtn: { padding: 4 },

  // Filter Chips
  filterStrip: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },

  // List & Cards
  list: { padding: SPACING.lg, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
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
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.primary,
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
    color: colors.textPrimary,
  },
  cardMeta: {
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  consultationsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  lastVisitSection: {
    marginTop: 6,
  },
  lastVisitLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  lastVisitValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
});
