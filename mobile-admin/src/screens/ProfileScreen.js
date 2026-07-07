import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import authService from '../services/authService';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { StatsSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

// Icon backgrounds are a translucent wash of the icon hue so the tint reads
// correctly over both light and dark cards (matches the users app).
const soft = hex => `${hex}22`;

const SUPPORT_EMAIL = 'support@purnazen.com';

const ProfileScreen = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const { colors } = useTheme();
  const headerTop = useHeaderTopPadding(16);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Profile trackers reuse the admin platform-stats endpoint that powers the
  // Home dashboard, so they stay consistent without a second source of truth.
  useEffect(() => {
    apiClient
      .get(ENDPOINTS.ADMIN_STATS)
      .then(res => setStats(res?.data ?? null))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const handleLogout = () => {
    showAlert(
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
              // Auth-state flip swaps the root navigator back to Login (App.tsx).
            } catch {
              // logout clears local state even if the server call fails
            }
          },
        },
      ],
    );
  };

  const openSupport = () =>
    showAlert(
      'Help & Support',
      `Reach the Purnazen team at ${SUPPORT_EMAIL} for help with the admin console.`,
    );

  const MENU_ITEMS = [
    { icon: 'cog-outline',         iconColor: '#6B7280', title: 'Settings',       subtitle: 'App preferences', onPress: () => navigation.navigate('Settings') },
    { icon: 'help-circle-outline', iconColor: '#0284c7', title: 'Help & Support', subtitle: 'Get assistance',  onPress: openSupport },
  ];

  const displayName = user?.full_name ?? 'Admin';
  const displayEmail = user?.email ?? '';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{avatarLetter}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text>
              <View style={styles.planBadge}>
                <MCIcon name="shield-crown" size={12} color={colors.white} style={{ marginRight: 4 }} />
                <Text style={styles.planText}>Administrator</Text>
              </View>
            </View>
          </View>

          {/* ── Trackers ── */}
          {statsLoading ? (
            <StatsSkeleton />
          ) : (
            <View style={styles.statsRow}>
              <View style={[styles.statBox, styles.statBorder]}>
                <Text style={styles.statValue}>{stats?.total_active_doctors ?? '—'}</Text>
                <Text style={styles.statLabel}>Doctors</Text>
              </View>
              <View style={[styles.statBox, styles.statBorder]}>
                <Text style={styles.statValue}>{stats?.total_active_users ?? '—'}</Text>
                <Text style={styles.statLabel}>Users</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats?.today_appointments ?? '—'}</Text>
                <Text style={styles.statLabel}>Appts Today</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Menu ── */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.menuCard}
              activeOpacity={0.7}
              onPress={item.onPress}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: soft(item.iconColor) }]}>
                <MCIcon name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <MCIcon name="chevron-right" size={20} color={colors.borderStrong} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <MCIcon name="logout" size={18} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },

  header: {
    backgroundColor: colors.headerBg,
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
    color: colors.white,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
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
    color: colors.white,
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
    color: colors.white,
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
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.black,
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
    color: colors.textPrimary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: soft(colors.danger),
    borderRadius: 16,
    paddingVertical: 16,
    backgroundColor: soft(colors.danger),
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
  },
});
