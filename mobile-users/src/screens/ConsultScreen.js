import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import consultService from '../services/consultService';
import useTheme from '../hooks/useTheme';
import EmptyState from '../components/EmptyState';
import useTaxConfig from '../hooks/useTaxConfig';
import Avatar from '../components/Avatar';
import {TAG_ICONS} from '../constants/icons';
import {CONSULT_SCREEN_FILTER_TABS_FALLBACK} from '../constants/miscellaneous';
import TabHeader from '../components/TabHeader';
import { ListSkeleton } from '../components/SkeletonLoader';


const FILTER_TABS_FALLBACK = CONSULT_SCREEN_FILTER_TABS_FALLBACK;


// Hero + search. The search box lives in the hero's `children` slot so this
// tab's header is the same TabHeader card as Home / Relief / Wellness.
const ConsultHeader = ({ styles, colors, searchQuery = '', onChangeText, onClear, navigation }) => (
  <TabHeader
    title="Consult"
    subtitle="Book a session with an expert doctor"
    right={
      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => navigation.navigate('AppointmentHistory')}
        accessibilityLabel="My appointments"
      >
        <MCIcon name="calendar-clock" size={22} color={colors.white} />
      </TouchableOpacity>
    }
  >
    <View style={styles.searchContainer}>
      <MCIcon name="magnify" size={20} color={colors.textMuted} style={inline.mr8} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search doctors, specialties..."
        placeholderTextColor={colors.textMuted}
        value={searchQuery}
        onChangeText={onChangeText}
        returnKeyType="search"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={onClear} style={styles.clearBtn} accessibilityLabel="Clear search">
          <MCIcon name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  </TabHeader>
);

const ConsultScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery]   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState(''); // Fix 2: debounce
  const [doctors, setDoctors]           = useState([]);
  // The backend has no /filter-tabs route (every launch 404'd and fell back
  // to this list), so the list is the source of truth.
  const filterTabs = FILTER_TABS_FALLBACK;
  const [isLoading, setIsLoading]       = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError]               = useState(null);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);

  // The listed fee is pre-tax, so it is labelled as such — otherwise the number
  // here and the total at checkout look like two different prices.
  const { gstPercentage } = useTaxConfig();
  const showsTax = (gstPercentage ?? 0) > 0;

  // Fix 8: ref to detect and ignore stale responses from rapid filter switching
  const fetchIdRef = useRef(0);

  // Fix 2: debounce search — wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);


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
        <Avatar uri={doctor.avatar} name={doctor.name} size={56} style={styles.avatarShape} />
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
          <Text style={styles.feeAmount}>
            ₹{doctor.minFee ?? doctor.fee}
            {showsTax ? <Text style={styles.feeTax}> + Tax</Text> : null}
          </Text>
        </View>
        <View style={[
          styles.availabilityBadge,
          doctor.availableToday ? styles.availableTodayBadge : styles.availableTomorrowBadge,
        ]}>
          <View style={[styles.availabilityDot, { backgroundColor: doctor.availableToday ? colors.primary : colors.textMuted }]} />
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

  // Empty / error state — both share the one EmptyState block.
  const renderEmpty = () => {
    if (isLoading) return null;
    if (error) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Couldn't load doctors"
          hint={error}
          action={{ label: 'Try again', onPress: retry }}
        />
      );
    }
    return (
      <EmptyState
        icon="doctor"
        title="No doctors found"
        hint={activeFilter === 'All' && !debouncedQuery
          ? 'Doctors appear here once they are listed.'
          : 'Try a different search or filter.'}
        action={activeFilter !== 'All' || debouncedQuery
          ? { label: 'Clear filters', onPress: () => { setActiveFilter('All'); setSearchQuery(''); } }
          : undefined}
      />
    );
  };

  const initialLoading = isLoading && doctors.length === 0;

  return (
    <View style={styles.root}>
      <ConsultHeader
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
        {filterTabs.map(tab => {
          const on = activeFilter === tab.label;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterTab, on && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab.label)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.filterTabText, on && styles.filterTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {initialLoading ? (
        <ListSkeleton count={4} />
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={item => String(item.id)}
          renderItem={renderDoctorCard}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

export default ConsultScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header — the hero card comes from <TabHeader/>; only the slot content is here.
  historyBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
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
  // Rounded square rather than a full circle — overrides Avatar's default.
  avatarShape: { borderRadius: 14, marginRight: 12 },
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
  feeTax: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  availabilityDot: { width: 6, height: 6, borderRadius: 3 },
  availableTodayBadge:    { backgroundColor: colors.primaryLight },
  availableTomorrowBadge: { backgroundColor: colors.surfaceMuted },
  availabilityText:       { fontSize: 12, fontWeight: '600' },
  availableTodayText:     { color: colors.primary },
  availableTomorrowText:  { color: colors.textSecondary },

  // Pagination footer loader
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

// Literal-only styles that used to sit inline in the JSX.
const inline = StyleSheet.create({
  mr8: { marginRight: 8 },
});
