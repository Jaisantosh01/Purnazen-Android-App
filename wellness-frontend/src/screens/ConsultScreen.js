import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { FILTER_TABS } from '../data/consultData';

// Fix 3: tag → icon mapping, fallback to 'tag-outline' for unknown tags
const TAG_ICONS = {
  'Video':      'video-outline',
  'Home Visit': 'home-outline',
};

// Shared header reused in loading/error states
// Fix 1: always pass searchQuery so TextInput is never uncontrolled
const ScreenHeader = ({ searchQuery = '', onChangeText, onClear, editable = true }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Book Consultation</Text>
    <Text style={styles.headerSubtitle}>Connect with expert doctors</Text>
    <View style={styles.searchContainer}>
      <MCIcon name="magnify" size={20} color="#9ca3af" style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search doctors, specialties..."
        placeholderTextColor="#9ca3af"
        value={searchQuery}
        onChangeText={onChangeText}
        editable={editable}
      />
      {editable && searchQuery.length > 0 && (
        // Fix 7: added padding so touch target is larger
        <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
          <MCIcon name="close" size={18} color="#9ca3af" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const ConsultScreen = ({ navigation }) => {
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

  // Fix 5: fallback to local FILTER_TABS if API fails so tabs never disappear
  useEffect(() => {
    consultService.getFilterTabs()
      .then(tabs => setFilterTabs(tabs))
      .catch(() => setFilterTabs(FILTER_TABS));
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
          <Text style={styles.avatarIcon}>{doctor.avatar}</Text>
        </View>
        <View style={styles.doctorInfo}>
          {/* Fix 6: numberOfLines prevents long names from breaking layout */}
          <Text style={styles.doctorName} numberOfLines={1}>{doctor.name}</Text>
          <Text style={styles.doctorSpecialty} numberOfLines={1}>{doctor.specialty}</Text>

          <View style={styles.ratingRow}>
            <MCIcon name="star" size={14} color="#f59e0b" />
            <Text style={styles.rating}> {doctor.rating}</Text>
            <Text style={styles.reviews}> ({doctor.reviews})</Text>
            <Text style={styles.separator}>  •  </Text>
            <Text style={styles.experience}>{doctor.experience} years</Text>
          </View>

          <View style={styles.locationRow}>
            <MCIcon name="map-marker-outline" size={13} color="#9ca3af" />
            <Text style={styles.location} numberOfLines={1}> {doctor.location}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tagsRow}>
        {doctor.tags.map((tag, index) => (
          <View key={index} style={styles.tag}>
            {/* Fix 3: use TAG_ICONS map with fallback */}
            <MCIcon
              name={TAG_ICONS[tag] || 'tag-outline'}
              size={13}
              color="#6b7280"
            />
            <Text style={styles.tagText}> {tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.feeLabel}>Consultation fee</Text>
          <Text style={styles.feeAmount}>₹{doctor.fee}</Text>
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
        <ActivityIndicator size="small" color="#1FA77A" />
      </View>
    );
  };

  // Empty state
  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <MCIcon name="doctor" size={60} color="#d1d5db" />
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
        <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />
        <ScreenHeader searchQuery={searchQuery} editable={false} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1FA77A" />
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
        <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />
        <ScreenHeader searchQuery={searchQuery} editable={false} />
        <View style={styles.centered}>
          <MCIcon name="alert-circle-outline" size={60} color="#ef4444" />
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
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      <ScreenHeader
        searchQuery={searchQuery}
        onChangeText={setSearchQuery}
        onClear={() => setSearchQuery('')}
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
            colors={['#1FA77A']}
            tintColor="#1FA77A"
          />
        }
      />
    </View>
  );
};

export default ConsultScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },

  // Header
  header: {
    backgroundColor: '#1FA77A',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
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
    backgroundColor: '#f5f5f5',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  filterTabActive: {
    backgroundColor: '#1FA77A',
    borderColor: '#1FA77A',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Doctor List
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 30,
  },
  doctorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    backgroundColor: '#f0faf6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarIcon: { fontSize: 30 },
  doctorInfo: { flex: 1 },
  doctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  doctorSpecialty: {
    fontSize: 12,
    color: '#6b7280',
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
    color: '#1a1a1a',
  },
  reviews: {
    fontSize: 12,
    color: '#9ca3af',
  },
  separator: {
    fontSize: 12,
    color: '#d1d5db',
  },
  experience: {
    fontSize: 12,
    color: '#9ca3af',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  location: {
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },

  // Divider & Footer
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  feeAmount: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1FA77A',
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  availableTodayBadge:    { backgroundColor: '#e8f8f2' },
  availableTomorrowBadge: { backgroundColor: '#f3f4f6' },
  availabilityText:       { fontSize: 12, fontWeight: '600' },
  availableTodayText:     { color: '#1FA77A' },
  availableTomorrowText:  { color: '#6b7280' },

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
    color: '#6b7280',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: '#1FA77A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
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
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
