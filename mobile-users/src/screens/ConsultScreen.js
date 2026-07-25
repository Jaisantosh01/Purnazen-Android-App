import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import consultService from '../services/consultService';
import useTheme from '../hooks/useTheme';
import { doctorInitial } from '../utils/doctorAvatar';
import {TAG_ICONS} from '../constants/icons';
import {CONSULT_SCREEN_FILTER_TABS_FALLBACK} from '../constants/miscellaneous';
import { useHeaderTopPadding } from '../components/ScreenHeader';


const FILTER_TABS_FALLBACK = CONSULT_SCREEN_FILTER_TABS_FALLBACK;


// Shared header reused in loading/error states
// Fix 1: always pass searchQuery so TextInput is never uncontrolled
const ScreenHeader = ({ styles, colors, searchQuery = '', onChangeText, onClear, editable = true, navigation }) => {
  const headerTop = useHeaderTopPadding();
  return (
  <View style={[styles.header, { paddingTop: headerTop }]}>
    <View style={styles.headerTopRow}>
      <View style={styles.headerTextCol}>
        <Text style={styles.headerTitle}>Book Consultation</Text>
        <Text style={styles.headerSubtitle}>Connect with expert doctors</Text>
      </View>
      <TouchableOpacity style={styles.historyBtn} onPress={() => navigation?.navigate('AppointmentHistory')}>
        <MCIcon name="calendar-clock" size={22} color={colors.white} />
      </TouchableOpacity>
    </View>
    <View style={styles.searchContainer}>
      <MCIcon name="magnify" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search doctors, specialties..."
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={onChangeText}
        editable={editable}
      />
      {editable && searchQuery.length > 0 && (
        // Fix 7: added padding so touch target is larger
        <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
          <MCIcon name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  </View>
  );
};

const ConsultScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery]   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(''); // Fix 2: debounce
  const [doctors, setDoctors]           = useState([]);
  const [filterTabs, setFilterTabs]     = useState([]);
  const [isLoading, setIsLoading]       = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError]               = useState(null);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);

  // Fix 8: ref to detect and ignore stale responses from rapid filter switching
  const fetchIdRef = useRef(0);

  // Fix 2: debounce search — wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    consultService.getFilterTabs()
      .then(tabs => setFilterTabs(tabs))
      .catch(() => setFilterTabs(FILTER_TABS_FALLBACK));
  }, []);

  // Fix 2 + Fix 8: use debouncedQuery in deps, ignore stale responses
  const fetchDoctors = useCallback(async (pageNum = 1, isRefresh = false) => {
    const fetchId = ++fetchIdRef.current;

    if (isRefresh) setIsRefreshing(true);
    else           setIsLoading(true);
    setError(null);

    try {
      const { doctors: newDoctors, hasMore: more } =
        await consultService.getDoctors(activeFilter, debouncedQuery, pageNum);

      // Fix 8: if a newer fetch has started, discard this stale response
      if (fetchId !== fetchIdRef.current) return;

      setDoctors(prev =>
        isRefresh || pageNum === 1 ? newDoctors : [...prev, ...newDoctors]
      );
      setHasMore(more);
      setPage(pageNum);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [activeFilter, debouncedQuery]);

  // Re-fetch from page 1 whenever filter or debounced search changes
  useEffect(() => {
    fetchDoctors(1);
  }, [fetchDoctors]);

  const loadMore = () => {
    if (!isLoading && !isRefreshing && hasMore) fetchDoctors(page + 1);
  };

  const refresh = () => fetchDoctors(1, true);
  const retry   = () => fetchDoctors(1);

  // Doctor card
  const renderDoctorCard = ({ item: doctor }) => (
    <TouchableOpacity
      style={styles.doctorCard}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('DoctorProfile', { doctor })}
    >
      <View style={styles.doctorTop}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarIcon}>{doctorInitial(doctor.name)}</Text>
        </View>
        <View style={styles.doctorInfo}>
          {/* Fix 6: numberOfLines prevents long names from breaking layout */}
          <Text style={styles.doctorName} numberOfLines={1}>{doctor.name}</Text>
          <Text style={styles.doctorSpecialty} numberOfLines={1}>{doctor.specialties || ''}</Text>

          {/* There is no review system yet, so `rating`/`reviews` come back as
              0 for every doctor — showing "★ 0.0 (0)" read as a bad score. The
              stars only appear once real reviews exist; experience is genuine
              admin-entered data and stands on its own. */}
          <View style={styles.ratingRow}>
            {doctor.reviews > 0 && (
              <>
                <MCIcon name="star" size={14} color={colors.warning} />
                <Text style={styles.rating}> {Number(doctor.rating).toFixed(1)}</Text>
                <Text style={styles.reviews}> ({doctor.reviews})</Text>
                {doctor.experience > 0 && <Text style={styles.separator}>  •  </Text>}
              </>
            )}
            {doctor.experience > 0 && (
              <Text style={styles.experience}>
                {doctor.experience} {doctor.experience === 1 ? 'year' : 'years'} experience
              </Text>
            )}
          </View>

          {!!doctor.location && (
            <View style={styles.locationRow}>
              <MCIcon name="map-marker-outline" size={13} color={colors.textMuted} />
              <Text style={styles.location} numberOfLines={1}> {doctor.location}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.tagsRow}>
        {doctor.tags.map((tag, index) => (
          <View key={index} style={styles.tag}>
            {/* Fix 3: use TAG_ICONS map with fallback */}
            <MCIcon
              name={TAG_ICONS[tag] || 'tag-outline'}
              size={13}
              color={colors.textSecondary}
            />
            <Text style={styles.tagText}> {tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.feeLabel}>Starts at only</Text>
          <Text style={styles.feeAmount}>₹{doctor.minFee ?? doctor.fee}</Text>
        </View>
        <View style={[
          styles.availabilityBadge,
          doctor.availableToday ? styles.availableTodayBadge : styles.availableTomorrowBadge,
        ]}>
          <Text style={[
            styles.availabilityText,
            doctor.availableToday ? styles.availableTodayText : styles.availableTomorrowText,
          ]}>
            {doctor.availability}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Pagination footer spinner
  const renderFooter = () => {
    if (!isLoading || doctors.length === 0) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // Empty state
  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <MCIcon name="doctor" size={60} color={colors.borderStrong} />
        <Text style={styles.emptyTitle}>No doctors found</Text>
        <Text style={styles.emptySubtitle}>Try a different search or filter</Text>
      </View>
    );
  };

  // Full-screen initial loading
  // Fix 1: pass searchQuery so header TextInput stays controlled
  if (isLoading && doctors.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
        <ScreenHeader styles={styles} colors={colors} searchQuery={searchQuery} editable={false} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading doctors...</Text>
        </View>
      </View>
    );
  }

  // Full-screen error
  // Fix 1: pass searchQuery so header TextInput stays controlled
  if (error && doctors.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
        <ScreenHeader styles={styles} colors={colors} searchQuery={searchQuery} editable={false} />
        <View style={styles.centered}>
          <MCIcon name="alert-circle-outline" size={60} color={colors.danger} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={retry} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main screen
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <ScreenHeader
        styles={styles}
        colors={colors}
        searchQuery={searchQuery}
        onChangeText={setSearchQuery}
        onClear={() => setSearchQuery('')}
        navigation={navigation}
      />

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {filterTabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.filterTab, activeFilter === tab.label && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.label)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.label && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Doctor List */}
      <FlatList
        data={doctors}
        // Fix 4: convert id to string so keyExtractor never warns
        keyExtractor={item => String(item.id)}
        renderItem={renderDoctorCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    </View>
  );
};

export default ConsultScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerTextCol: { flex: 1 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 16,
  },
  historyBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12, marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  // Fix 7: larger touch target for clear button
  clearBtn: {
    padding: 6,
  },

  // Filter Tabs
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.background,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  // Doctor List
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 30,
  },
  doctorCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Doctor Top
  doctorTop: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarIcon: { fontSize: 26, fontWeight: '800', color: colors.primary },
  doctorInfo: { flex: 1 },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  doctorSpecialty: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reviews: {
    fontSize: 12,
    color: colors.textMuted,
  },
  separator: {
    fontSize: 12,
    color: colors.borderStrong,
  },
  experience: {
    fontSize: 12,
    color: colors.textMuted,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Tags
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Divider & Footer
  divider: {
    height: 1,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  feeAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  availableTodayBadge:    { backgroundColor: colors.primaryLight },
  availableTomorrowBadge: { backgroundColor: colors.surfaceMuted },
  availabilityText:       { fontSize: 12, fontWeight: '600' },
  availableTodayText:     { color: colors.primary },
  availableTomorrowText:  { color: colors.textSecondary },

  // Centered (loading / error full-screen)
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },

  // Pagination footer loader
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
