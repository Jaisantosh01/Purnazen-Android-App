import React, { useEffect, useState } from 'react';
import { STRINGS } from '../constants/strings';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import QuickCard from '../components/QuickCards';
import { WellnessRowSkeleton, QuickCardSkeleton } from '../components/SkeletonLoader';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
// import wellnessService from '../services/wellnessService';
import { COLORS } from '../constants/theme';

const HOME_WELLNESS_ROWS = 3; 
const HOME_QUICK_RELIEF_LIMIT = 3; 

const HomeScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.ADMIN_STATS)
      .then(res => setStats(res?.data || null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  const KpiCard = ({ title, value, icon, color, onPress }) => (
    <TouchableOpacity style={styles.kpiCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.kpiIconCircle, { backgroundColor: color + '20' }]}>
        <MCIcon name={icon} size={24} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value ?? '-'}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Overview of your wellness platform</Text>
        </View>

        {/* ── KPIs ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Statistics</Text>
          <View style={styles.statsGrid}>
            <KpiCard
              title="Active Doctors"
              value={stats?.total_active_doctors}
              icon="doctor"
              color="#4A90E2"
              onPress={() => navigation.navigate('Doctors', { screen: 'DoctorsMain' })}
            />
            <KpiCard
              title="Active Users"
              value={stats?.total_active_users}
              icon="account-group"
              color="#50C878"
              onPress={() => navigation.navigate('Users', { screen: 'UsersMain' })}
            />
            <KpiCard
              title="Today's Appts"
              value={stats?.today_appointments}
              icon="calendar-today"
              color="#FF7F50"
              onPress={() => navigation.navigate('Appointments', { screen: 'AppointmentsMain', params: { filterDate: todayStr } })}
            />
            <KpiCard
              title="Scheduled Appts"
              value={stats?.scheduled_appointments}
              icon="calendar-clock"
              color="#9370DB"
            />
            <KpiCard
              title="Today Leaves"
              value={stats?.today_doctor_leaves}
              icon="beach"
              color="#F59E0B"
              onPress={() => navigation.navigate('DoctorLeaveManagement')}
            />
            <KpiCard
              title="Total Leaves"
              value={stats?.total_doctor_leaves}
              icon="calendar-remove"
              color="#EF4444"
              onPress={() => navigation.navigate('DoctorLeaveManagement')}
            />
          </View>
        </View>

        {/* ── Management ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>
          <View style={{ gap: 12 }}>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('DoctorLeaveManagement')}>
                <MCIcon name="beach" size={32} color={COLORS.warning} />
                <Text style={styles.managementText}>Doctor Leaves</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('SlotManagement')}>
                <MCIcon name="clock-outline" size={32} color={COLORS.primary} />
                <Text style={styles.managementText}>Time Slots</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.managementCard} onPress={() => navigation.navigate('VideoManagement')}>
                <MCIcon name="video-outline" size={32} color={COLORS.accent} />
                <Text style={styles.managementText}>Wellness Videos</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    fontSize: 26,
    color: COLORS.white,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 2,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  kpiCard: {
    backgroundColor: COLORS.white,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  kpiTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  managementCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  managementText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
