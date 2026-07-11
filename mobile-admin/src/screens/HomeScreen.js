import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const headerTop = useHeaderTopPadding(16);
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

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
  const todayStr = now.toISOString().slice(0, 10);

  // Single-accent KPI tiles: neutral value text with the brand accent reserved
  // for the icon, instead of a per-tile rainbow.
  const KpiCard = ({ title, value, icon, onPress }) => (
    <TouchableOpacity style={styles.kpiCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.kpiIconCircle, { backgroundColor: colors.primaryLight }]}>
        <MCIcon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.kpiValue}>{value ?? '-'}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </TouchableOpacity>
  );

  const KpiSkeleton = () => (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconCircle, { backgroundColor: colors.surfaceMuted }]}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceMuted }} />
      </View>
      <View style={{ width: 40, height: 24, borderRadius: 6, backgroundColor: colors.surfaceMuted, marginTop: 8 }} />
      <View style={{ width: 70, height: 12, borderRadius: 6, backgroundColor: colors.surfaceMuted, marginTop: 6 }} />
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} colors={[colors.primary]} />
        }
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.title}>Admin Dashboard</Text>
            </View>
            <View style={styles.dateChip}>
              <MCIcon name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.dateChipText}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* ── KPIs ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <MCIcon name="chart-box-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.sectionTitle}>Platform Statistics</Text>
          </View>
          <View style={styles.statsGrid}>
            {loading ? (
              <>
                <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
                <KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
              </>
            ) : (
              <>
                <KpiCard
                  title="Active Doctors"
                  value={stats?.total_active_doctors}
                  icon="doctor"
                  onPress={() => navigation.navigate('Manage', { screen: 'UsersAndDoctorsMain', params: { tab: 'doctors' } })}
                />
                <KpiCard
                  title="Active Users"
                  value={stats?.total_active_users}
                  icon="account-group"
                  onPress={() => navigation.navigate('Manage', { screen: 'UsersAndDoctorsMain', params: { tab: 'users' } })}
                />
                <KpiCard
                  title="Today's Appts"
                  value={stats?.today_appointments}
                  icon="calendar-today"
                  onPress={() => navigation.navigate('Manage', { screen: 'AppointmentsMain', params: { filterDate: todayStr } })}
                />
                <KpiCard
                  title="Scheduled Appts"
                  value={stats?.scheduled_appointments}
                  icon="calendar-clock"
                />
                <KpiCard
                  title="Today Leaves"
                  value={stats?.today_doctor_leaves}
                  icon="beach"
                  onPress={() => navigation.navigate('Manage', { screen: 'DoctorLeaveManagement' })}
                />
                <KpiCard
                  title="Total Leaves"
                  value={stats?.total_doctor_leaves}
                  icon="calendar-remove"
                  onPress={() => navigation.navigate('Manage', { screen: 'DoctorLeaveManagement' })}
                />
              </>
            )}
          </View>
        </View>

        {/* ── Management ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <MCIcon name="view-dashboard-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('Manage', { screen: 'SlotManagement' })} activeOpacity={0.7}>
              <View style={[styles.mgmtIconCircle, { backgroundColor: colors.primaryLight }]}>
                <MCIcon name="clock-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.mgmtTextCol}>
                <Text style={styles.mgmtTitle}>Time Slots</Text>
                <Text style={styles.mgmtSub}>Configure available time slots</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('Manage', { screen: 'VideoManagement' })} activeOpacity={0.7}>
              <View style={[styles.mgmtIconCircle, { backgroundColor: colors.primaryLight }]}>
                <MCIcon name="video-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.mgmtTextCol}>
                <Text style={styles.mgmtTitle}>Wellness Videos</Text>
                <Text style={styles.mgmtSub}>Manage wellness video content</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('Manage', { screen: 'NotificationAdmin' })} activeOpacity={0.7}>
              <View style={[styles.mgmtIconCircle, { backgroundColor: colors.primaryLight }]}>
                <MCIcon name="bell-cog-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.mgmtTextCol}>
                <Text style={styles.mgmtTitle}>Notifications</Text>
                <Text style={styles.mgmtSub}>Broadcasts, switches & reminders</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('Manage', { screen: 'FaqManagement' })} activeOpacity={0.7}>
              <View style={[styles.mgmtIconCircle, { backgroundColor: colors.primaryLight }]}>
                <MCIcon name="help-circle-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.mgmtTextCol}>
                <Text style={styles.mgmtTitle}>FAQ Management</Text>
                <Text style={styles.mgmtSub}>Configure FAQ content</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('Manage', { screen: 'ContentManagement' })} activeOpacity={0.7}>
              <View style={[styles.mgmtIconCircle, { backgroundColor: colors.primaryLight }]}>
                <MCIcon name="file-document-edit-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.mgmtTextCol}>
                <Text style={styles.mgmtTitle}>Content Management</Text>
                <Text style={styles.mgmtSub}>Terms & conditions, privacy policy</Text>
              </View>
              <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },

  // Header — headerBg (not primary) so the hero darkens with the scheme like
  // every other screen's header card.
  header: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTextCol: { flex: 1 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  title: { fontSize: 26, color: colors.headerText, fontWeight: '800', letterSpacing: 0.2, marginTop: 2 },
  dateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  dateChipText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  kpiCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiIconCircle: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
  },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 10, color: colors.textPrimary },
  kpiTitle: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center', fontWeight: '600' },

  // Management
  managementCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  mgmtIconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  mgmtTextCol: { flex: 1 },
  mgmtTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  mgmtSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
});
