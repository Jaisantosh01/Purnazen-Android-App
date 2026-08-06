import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import authService from '../services/authService';
import appointmentService from '../services/appointmentService';
import useTheme from '../hooks/useTheme';
import AppVersionFooter from '../components/AppVersionFooter';
import Avatar from '../components/Avatar';
import { useHeaderTopPadding } from '../components/ScreenHeader';
import { checkForUpdate, FORCE_MARKER } from '../services/updateService';
import { isOtaSupported, startBackgroundInstall } from '../services/otaUpdater';
import { APP_VERSION } from '../config';

// Icon backgrounds are a translucent wash of the icon hue so the tint reads
// correctly over both light and dark cards.
const soft = hex => `${hex}22`;

const isToday = value => {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
};

const ProfileScreen = ({ navigation }) => {
  const headerTop = useHeaderTopPadding(16);
  const doctor = useAuthStore(state => state.doctor);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Trackers derive from the doctor's own appointment list — no separate stats
  // endpoint needed. Counts: today, upcoming (scheduled), and completed.
  useEffect(() => {
    appointmentService
      .getDoctorAppointments()
      .then(data => {
        const list = data?.appointments ?? [];
        const today = list.filter(a => isToday(a.date)).length;
        const upcoming = list.filter(a => a.status === 'booked' || a.status === 'pending').length;
        const completed = list.filter(a => a.status === 'completed').length;
        setStats({ today, upcoming, completed });
      })
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const [updateChecking, setUpdateChecking] = useState(false);

  const handleCheckForUpdate = async () => {
    if (updateChecking) return;
    setUpdateChecking(true);
    try {
      const u = await checkForUpdate({ force: true });
      if (!u) {
        showAlert('Up to date', `You're on the latest version (v${APP_VERSION}).`);
        return;
      }
      const openApk = () => { Linking.openURL(u.apkUrl).catch(() => {}); };
      // Prefer the in-app background download + install; fall back to the browser
      // hand-off when the native OTA module isn't present.
      const startUpdate = isOtaSupported()
        ? () => {
            startBackgroundInstall(
              { url: u.apkUrl, version: u.version, sha256: u.sha256 },
              { onError: () => showAlert('Update', 'The update download failed. Please try again later.') },
            );
            showAlert(
              'Downloading update',
              `Version ${u.version} is downloading in the background. It will install as soon as it's ready — the app may restart to finish.`,
            );
          }
        : openApk;
      const notes = (u.notes || '')
        .split('\n')
        .filter(l => !l.includes(FORCE_MARKER))
        .join('\n')
        .trim();
      const body =
        `Version ${u.version} is available${u.current ? ` (you have v${u.current})` : ''}.` +
        (u.forced ? '\n\nThis is a critical update and is required to continue.' : '') +
        (notes ? `\n\n${notes}` : '');
      const buttons = u.forced
        ? [{ text: 'Update now', onPress: startUpdate }]
        : [
            { text: 'Later', style: 'cancel' },
            { text: 'Update now', onPress: startUpdate },
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

  // Leave lives under Schedule → Leave; the duplicate shortcuts that used to sit
  // here were removed so there's one place to apply for / review leave.
  const MENU_ITEMS = [
    { icon: 'cog-outline',         iconColor: '#6B7280', title: 'Settings',          subtitle: 'App preferences', onPress: () => navigation.navigate('Settings') },
    { icon: 'cloud-download-outline', iconColor: '#0D9488', title: 'Check for Updates', subtitle: null,          onPressKey: 'checkUpdate' },
    { icon: 'help-circle-outline', iconColor: '#0284c7', title: 'Help & Support',    subtitle: 'Get assistance', onPress: () => navigation.navigate('HelpSupport') },
  ];

  const displayName = doctor?.full_name ?? doctor?.name ?? 'Doctor';
  const displayEmail = doctor?.email ?? '';

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
            {/* Tapping the photo goes straight to the picker in Settings →
                Edit Profile, which is the one place a photo can be changed. */}
            <TouchableOpacity
              style={styles.avatarWrap}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Settings', { openEditProfile: true })}
            >
              <Avatar
                uri={doctor?.avatar_url}
                name={displayName}
                size={64}
                backgroundColor="rgba(255,255,255,0.25)"
                textColor={colors.white}
              />
              <View style={styles.avatarEditBadge}>
                <MCIcon name="camera-outline" size={12} color={colors.headerBg} />
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text>
              <View style={styles.planBadge}>
                <MCIcon name="stethoscope" size={12} color={colors.white} style={{ marginRight: 4 }} />
                <Text style={styles.planText}>Doctor</Text>
              </View>
            </View>
          </View>

          {/* ── Trackers ──
              These are appointment counts, which the bare "Today / Upcoming /
              Completed" labels never said. Captioned, spelled out, and tapping
              any of them opens the Appointments tab so the numbers are
              traceable to a list. */}
          <Text style={styles.statsCaption}>MY APPOINTMENTS</Text>
          <View style={styles.statsRow}>
            {[
              { key: 'today',     value: stats?.today,     label: 'Today' },
              { key: 'upcoming',  value: stats?.upcoming,  label: 'Upcoming' },
              { key: 'completed', value: stats?.completed, label: 'Completed' },
            ].map((s, i, arr) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.statBox, i < arr.length - 1 && styles.statBorder]}
                activeOpacity={0.7}
                onPress={() => navigation.getParent()?.navigate('Appointments')}
              >
                <Text style={styles.statValue}>{statsLoading ? '·' : (s.value ?? '—')}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Menu ── */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.title}
              style={styles.menuCard}
              activeOpacity={0.7}
              onPress={() => {
                if (item.onPressKey === 'checkUpdate') return handleCheckForUpdate();
                if (item.onPress) item.onPress();
              }}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: soft(item.iconColor) }]}>
                <MCIcon name={item.icon} size={20} color={item.iconColor} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle || (item.onPressKey === 'checkUpdate' ? (updateChecking ? 'Checking\u2026' : `Current v${APP_VERSION}`) : '')}</Text>
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
  avatarWrap: { marginRight: 16 },
  // Small "you can change this" affordance pinned to the photo.
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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

  statsCaption: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
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
