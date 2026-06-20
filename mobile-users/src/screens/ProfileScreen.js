import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import authService from '../services/authService';
import therapyService from '../services/therapyService';
import { StatsSkeleton } from '../components/SkeletonLoader';
import { COLORS } from '../constants/theme';
import useTheme from '../hooks/useTheme';

const MENU_ITEMS = [
  { icon: 'calendar-clock',   iconColor: '#0891B2',            iconBg: '#CFFAFE',            title: 'Appointments',     subtitle: 'View appointment history',  screen: 'AppointmentHistory' },
  { icon: 'history',          iconColor: COLORS.primary,        iconBg: COLORS.primaryLight,  title: 'Therapy History',  subtitle: 'View past sessions',        screen: 'TherapyHistory' },
  { icon: 'credit-card',      iconColor: COLORS.accent,         iconBg: COLORS.accentLight,   title: 'Subscriptions',    subtitle: 'Manage your plan',          screen: 'Subscriptions' },
  { icon: 'bell-outline',     iconColor: '#ea580c',             iconBg: '#FFF3E0',            title: 'Notifications',    subtitle: 'Manage alerts',             screen: 'Notifications' },
  { icon: 'cog-outline',      iconColor: COLORS.textSecondary,  iconBg: COLORS.surfaceMuted,  title: 'Settings',         subtitle: 'App preferences',           screen: 'Settings' },
  { icon: 'help-circle-outline', iconColor: '#0284c7',          iconBg: '#E0F2FE',            title: 'Help & Support',   subtitle: 'Get assistance',            screen: 'HelpSupport' },
];

const ProfileScreen = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    therapyService
      .getTherapyHistory()
      .then(data => setStats(data?.stats ?? null))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.logout();
              // Auth-state flip in authStore causes App.tsx navigator to
              // unmount MainTabs and render Login automatically — no explicit
              // navigation.replace() needed.
            } catch {
              // Logout already clears local state even if server call fails
            }
          },
        },
      ],
    );
  };

  const displayName = user?.full_name ?? 'Guest';
  const displayEmail = user?.email ?? '';
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const plan = user?.plan ?? 'Free';

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
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text>
              <View style={styles.planBadge}>
                <MCIcon name="shield-check" size={12} color={COLORS.white} style={{ marginRight: 4 }} />
                <Text style={styles.planText}>{plan} Member</Text>
              </View>
            </View>
          </View>

          {/* ── Stats ── */}
          {statsLoading ? (
            <StatsSkeleton />
          ) : (
            <View style={styles.statsRow}>
              <View style={[styles.statBox, styles.statBorder]}>
                <Text style={styles.statValue}>{stats?.sessions ?? '—'}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={[styles.statBox, styles.statBorder]}>
                <Text style={styles.statValue}>{stats?.minutes ?? '—'}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats?.avgRelief != null ? `${stats.avgRelief}%` : '—'}</Text>
                <Text style={styles.statLabel}>Avg Relief</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Menu ── */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.screen}
              style={styles.menuCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: item.iconBg }]}>
                <MCIcon name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <MCIcon name="chevron-right" size={20} color={COLORS.borderStrong} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <MCIcon name="logout" size={18} color={COLORS.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

const makeStyles = COLORS => StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.white,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  profileEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  planBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  planText: {
    fontSize: 11,
    color: COLORS.white,
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  menuSection: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuInfo: { flex: 1 },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 16,
    paddingVertical: 16,
    backgroundColor: '#fff5f5',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.danger,
  },
});
