import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { COLORS } from '../constants/theme';

const MENU_ITEMS = [
  { icon: '🕐', title: 'Therapy History',  subtitle: 'View past sessions',  screen: 'TherapyHistory' },
  { icon: '💳', title: 'Subscriptions',    subtitle: 'Manage plans',        screen: 'Subscriptions' },
  { icon: '🔔', title: 'Notifications',    subtitle: 'Manage alerts',       screen: 'Notifications' },
  { icon: '⚙️', title: 'Settings',         subtitle: 'App preferences',     screen: 'Settings' },
  { icon: '❓', title: 'Help & Support',   subtitle: 'Get assistance',      screen: 'HelpSupport' },
];

const STATS = [
  { icon: '🎯', value: '24',     label: 'Sessions' },
  { icon: '🔥', value: '7 days', label: 'Streak'   },
  { icon: '⏱️', value: '180',    label: 'Minutes'  },
];

const ProfileScreen = ({ navigation }) => {

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => Alert.alert('Logged out successfully!'),
        },
      ]
    );
  };

  const handleMenuPress = (screen) => {
    if (screen) {
      navigation.navigate(screen);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarIcon}>🐵</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>Jaisantosh</Text>
              <Text style={styles.profileEmail}>jaisantosh@email.com</Text>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>🛡️ Premium Member</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            {STATS.map((stat, index) => (
              <View
                key={index}
                style={[
                  styles.statBox,
                  index < STATS.length - 1 && styles.statBorder,
                ]}
              >
                <Text style={styles.statIcon}>{stat.icon}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Streak Banner ── */}
        <View style={styles.streakBanner}>
          <View style={styles.streakIconCircle}>
            <Text style={{ fontSize: 22 }}>🏆</Text>
          </View>
          <View style={styles.streakInfo}>
            <Text style={styles.streakTitle}>7-Day Streak!</Text>
            <Text style={styles.streakSub}>Keep it up! You're doing great</Text>
          </View>
          <Text style={styles.streakStar}>⭐</Text>
        </View>

        {/* ── Menu Items ── */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuCard}
              activeOpacity={0.7}
              onPress={() => handleMenuPress(item.screen)}
            >
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>↪ Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
  avatarIcon: { fontSize: 36 },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  profileEmail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  premiumBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  premiumText: {
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
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 14,
  },
  streakIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  streakInfo: { flex: 1 },
  streakTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  streakSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  streakStar: { fontSize: 20 },
  menuSection: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuIcon: { fontSize: 18 },
  menuInfo: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 20,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff5f5',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.danger,
  },
});
