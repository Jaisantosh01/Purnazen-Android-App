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
import { checkForUpdate, openStoreListing } from '../services/updateService';
import { APP_VERSION } from '../config';
import AppVersionFooter from '../components/AppVersionFooter';
import Avatar from '../components/Avatar';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { StatsSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

const soft = hex => `${hex}22`;

const ProfileScreen = ({ navigation }) => {
  const user = useAuthStore(state => state.user);
  const { colors } = useTheme();
  const headerTop = useHeaderTopPadding(16);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [updateChecking, setUpdateChecking] = useState(false);

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
            } catch {}
          },
        },
      ],
    );
  };

  const handleCheckForUpdate = async () => {
    if (updateChecking) return;
    setUpdateChecking(true);
    try {
      const u = await checkForUpdate({ force: true });
      if (!u) {
        showAlert('Up to date', `You're on the latest version (v${APP_VERSION}).`);
        return;
      }
      const body =
        `Version ${u.version} is available${u.current ? ` (you have v${u.current})` : ''}.` +
        (u.forced ? '\n\nThis is a critical update and is required to continue.' : '') +
        (u.notes ? `\n\n${u.notes}` : '');
      const buttons = u.forced
        ? [{ text: 'Open store', onPress: openStoreListing }]
        : [
            { text: 'Later', style: 'cancel' },
            { text: 'Open store', onPress: openStoreListing },
          ];
      showAlert(
        u.forced ? 'Update required' : 'Update available',
        body,
        buttons,
        { cancelable: !u.forced },
      );
    } catch {
      showAlert('Check for Updates', 'Could not check for updates. Please try again later.');
    } finally {
      setUpdateChecking(false);
    }
  };

  // Grouped: the admin's workspace shortcuts, then the app. Each group renders
  // as one card with hairline dividers (same as the patient/doctor apps).
  const MENU_GROUPS = [
    ['WORKSPACE', [
      { icon: 'message-star-outline', iconColor: '#D97706', title: 'Patient Feedback', subtitle: 'Review consultation ratings', onPress: () => navigation.navigate('Manage', { screen: 'FeedbackReview' }) },
      { icon: 'bell-ring-outline',    iconColor: '#ea580c', title: 'Notifications',    subtitle: 'Send and review broadcasts',  onPress: () => navigation.navigate('Manage', { screen: 'NotificationAdmin' }) },
    ]],
    ['APP', [
      { icon: 'cog-outline',            iconColor: '#6B7280', title: 'Settings',          subtitle: 'App preferences',       onPress: () => navigation.navigate('Settings') },
      { icon: 'cloud-download-outline', iconColor: '#0D9488', title: 'Check for Updates', subtitle: updateChecking ? 'Checking\u2026' : `Current v${APP_VERSION}`, onPress: handleCheckForUpdate },
      { icon: 'help-circle-outline',    iconColor: '#0284C7', title: 'Help & Support',    subtitle: 'FAQ, Terms & Policies', onPress: () => navigation.navigate('HelpSupport') },
    ]],
  ];

  const displayName = user?.full_name ?? 'Admin';
  const displayEmail = user?.email ?? '';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={inline.pb24}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <View style={styles.profileRow}>
            <Avatar
              uri={user?.avatar_url}
              name={displayName}
              size={64}
              backgroundColor="rgba(255,255,255,0.25)"
              textColor={colors.white}
              style={styles.avatarSpacing}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text>
              <View style={styles.planBadge}>
                <MCIcon name="shield-crown" size={12} color={colors.white} style={inline.mr4} />
                <Text style={styles.planText}>Administrator</Text>
              </View>
            </View>
          </View>

          {statsLoading ? (
            <StatsSkeleton />
          ) : (
            <View style={styles.statsRow}>
              <View style={[styles.statBox, styles.statBorder]}>
                <Text style={styles.statValue}>{stats?.total_active_doctors ?? '\u2014'}</Text>
                <Text style={styles.statLabel}>Doctors</Text>
              </View>
              <View style={[styles.statBox, styles.statBorder]}>
                <Text style={styles.statValue}>{stats?.total_active_users ?? '\u2014'}</Text>
                <Text style={styles.statLabel}>Users</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats?.today_appointments ?? '\u2014'}</Text>
                <Text style={styles.statLabel}>Appts Today</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Menu ── */}
        {MENU_GROUPS.map(([label, items]) => (
          <View key={label} style={styles.menuSection}>
            <Text style={styles.menuGroupLabel}>{label}</Text>
            <View style={styles.menuCard}>
              {items.map((item, i) => (
                <TouchableOpacity
                  key={item.title}
                  style={[styles.menuRow, i < items.length - 1 && styles.menuRowDivider]}
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
          </View>
        ))}

        {/* ── Logout ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <MCIcon name="logout" size={18} color={colors.danger} style={inline.mr8} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Build stamp + brand, same as the patient and doctor apps. */}
        <AppVersionFooter />

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
  avatarSpacing: { marginRight: 16 },
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
    gap: 8,
  },
  menuGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.textMuted,
    marginLeft: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
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

// Literal-only styles that used to sit inline in the JSX.
const inline = StyleSheet.create({
  mr8: { marginRight: 8 },
  mr4: { marginRight: 4 },
  pb24: { paddingBottom: 24 },
});
