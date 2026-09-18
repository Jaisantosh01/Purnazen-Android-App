import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import TabHeader from '../components/TabHeader';
import { GridCardSkeleton } from '../components/SkeletonLoader';
import { reliefCardColors, blend } from '../utils/cardTheme';

const greeting = h => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
const todayLabel = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// Hero strip — the three numbers an admin checks first.
const HERO = [
  { key: 'total_active_doctors', label: 'Doctors', icon: 'doctor' },
  { key: 'total_active_users',   label: 'Users',   icon: 'account-group-outline' },
  { key: 'today_appointments',   label: 'Today',   icon: 'calendar-today' },
];

// Tinted 2-up tiles (same treatment as the patient app's grids). Each lands on
// the filtered list it counts.
const TILES = (todayStr) => [
  { key: 'today_appointments',     title: "Today's appointments", sub: 'Across all doctors',    icon: 'calendar-today',      hue: '#2563EB', to: ['AppointmentsMain', { filterDate: todayStr }] },
  { key: 'scheduled_appointments', title: 'Scheduled',            sub: 'Booked & pending',      icon: 'calendar-clock',      hue: '#0D9488', to: ['AppointmentsMain', { filterStatus: 'booked' }] },
  { key: 'total_doctor_leaves',    title: 'Leave requests',       sub: 'Approved & pending',    icon: 'calendar-remove',     hue: '#D97706', to: ['DoctorLeaveManagement', { initialStatus: 'pending' }] },
  { key: 'today_doctor_leaves',    title: 'On leave today',       sub: 'Doctors unavailable',   icon: 'account-off-outline', hue: '#DC2626', to: ['DoctorLeaveManagement', {}] },
  { key: 'total_active_doctors',   title: 'Active doctors',       sub: 'Accepting bookings',    icon: 'doctor',              hue: '#7C3AED', to: ['UsersAndDoctorsMain', { tab: 'doctors' }] },
  { key: 'total_inactive_doctors', title: 'Inactive doctors',     sub: 'Hidden from patients',  icon: 'account-cancel-outline', hue: '#6B7280', to: ['UsersAndDoctorsMain', { tab: 'doctors' }] },
];

const HomeScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback((silent) => {
    if (!silent) setLoading(true);
    apiClient
      .get(ENDPOINTS.ADMIN_STATS)
      .then(res => setStats(res?.data || null))
      .catch(() => setStats(null))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats(true);
  }, [fetchStats]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const tiles = TILES(todayStr);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <TabHeader title={`${greeting(new Date().getHours())}`} subtitle={todayLabel()}>
          <View style={styles.statsRow}>
            {HERO.map((h, i) => (
              <View key={h.key} style={[styles.statBox, i < HERO.length - 1 && styles.statBorder]}>
                <MCIcon name={h.icon} size={20} color={colors.white} />
                <Text style={styles.statValue}>{loading ? '·' : stats?.[h.key] ?? '—'}</Text>
                <Text style={styles.statLabel}>{h.label}</Text>
              </View>
            ))}
          </View>
        </TabHeader>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform at a glance</Text>
          <View style={styles.grid}>
            {loading
              ? tiles.map(t => <GridCardSkeleton key={t.key} />)
              : tiles.map(t => {
                  const c = reliefCardColors({ bg: blend(t.hue, colors.card, 0.12), fg: t.hue, colors, isDark });
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.tile, { backgroundColor: c.background }]}
                      activeOpacity={0.85}
                      onPress={() => navigation.navigate('Manage', { screen: t.to[0], params: t.to[1] })}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: blend(t.hue, c.background, 0.14) }]}>
                        <MCIcon name={t.icon} size={22} color={c.accent} />
                      </View>
                      <Text style={[styles.tileValue, { color: c.title }]}>{stats?.[t.key] ?? '—'}</Text>
                      <Text style={[styles.tileTitle, { color: c.title }]} numberOfLines={1}>{t.title}</Text>
                      <Text style={[styles.tileSub, { color: c.subtitle }]} numberOfLines={1}>{t.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 32 },

  // Stats strip inside the hero — fixed white-on-brand like the other apps.
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 12,
  },
  statBox:    { flex: 1, alignItems: 'center', gap: 2 },
  statBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' },
  statValue:  { fontSize: 20, fontWeight: '800', color: colors.white, fontVariant: ['tabular-nums'] },
  statLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    minHeight: 150,
    justifyContent: 'space-between',
  },
  tileIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  tileValue: { fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tileTitle: { fontSize: 13.5, fontWeight: '700', marginTop: 2 },
  tileSub: { fontSize: 11.5, marginTop: 1 },
});
