import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const NOTIFICATION_GROUPS = [
  {
    title: 'Wellness',
    items: [
      { id: 'session_reminder', icon: 'yoga', iconColor: '#7c3aed', iconBg: '#F3EEFF', title: 'Session Reminders', subtitle: 'Daily yoga & meditation alerts', default: true },
      { id: 'streak_alert',    icon: 'fire',  iconColor: '#ea580c', iconBg: '#FFF3E0', title: 'Streak Alerts',     subtitle: 'Keep your streak going',       default: true },
      { id: 'new_program',     icon: 'star-outline', iconColor: '#f59e0b', iconBg: '#FFFBEB', title: 'New Programs', subtitle: 'When new sessions are added', default: false },
    ],
  },
  {
    title: 'Consultations',
    items: [
      { id: 'appointment',  icon: 'calendar-clock',  iconColor: '#1FA77A', iconBg: '#e8f8f2', title: 'Appointment Reminders', subtitle: '1 hour before your booking',  default: true  },
      { id: 'doctor_reply', icon: 'doctor',           iconColor: '#0284c7', iconBg: '#E0F2FE', title: 'Doctor Messages',       subtitle: 'When a doctor replies to you', default: true  },
      { id: 'booking_conf', icon: 'check-circle-outline', iconColor: '#1FA77A', iconBg: '#e8f8f2', title: 'Booking Confirmed', subtitle: 'Confirmation of appointments', default: true },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'payment',   icon: 'credit-card-outline', iconColor: '#6b7280', iconBg: '#f3f4f6', title: 'Payment Updates',  subtitle: 'Receipts & payment alerts',   default: true  },
      { id: 'offers',    icon: 'tag-outline',          iconColor: '#f59e0b', iconBg: '#FFFBEB', title: 'Offers & Deals',  subtitle: 'Discounts & promotions',      default: false },
      { id: 'security',  icon: 'shield-lock-outline',  iconColor: '#D46F6F', iconBg: '#FFEEEE', title: 'Security Alerts', subtitle: 'Login & account activity',    default: true  },
    ],
  },
];

const RECENT_NOTIFICATIONS = [
  { id: '1', icon: 'calendar-check', color: '#1FA77A', bg: '#e8f8f2', title: 'Appointment Confirmed', body: 'Your session with Dr. Sarah Chen is confirmed for tomorrow at 10:00 AM.', time: '2 hrs ago' },
  { id: '2', icon: 'fire',           color: '#ea580c', bg: '#FFF3E0', title: '7-Day Streak! 🔥',      body: 'Amazing! You have completed 7 days in a row. Keep it up!',              time: '5 hrs ago' },
  { id: '3', icon: 'yoga',           color: '#7c3aed', bg: '#F3EEFF', title: 'Session Reminder',      body: 'Your Guided Meditation session starts in 30 minutes.',                 time: 'Yesterday'  },
  { id: '4', icon: 'tag-outline',    color: '#f59e0b', bg: '#FFFBEB', title: 'Special Offer',         body: 'Get 30% off on Premium plan. Offer valid till end of this month.',      time: '2 days ago' },
];

const NotificationsScreen = ({ navigation }) => {
  const initState = {};
  NOTIFICATION_GROUPS.forEach(g => g.items.forEach(i => { initState[i.id] = i.default; }));
  const [enabled, setEnabled] = useState(initState);
  const [allEnabled, setAllEnabled] = useState(true);

  const toggle = (id) => setEnabled(prev => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = (val) => {
    setAllEnabled(val);
    const next = {};
    NOTIFICATION_GROUPS.forEach(g => g.items.forEach(i => { next[i.id] = val; }));
    setEnabled(next);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Manage your alerts</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Master toggle */}
        <View style={styles.masterRow}>
          <View style={styles.masterLeft}>
            <MCIcon name="bell-outline" size={22} color="#1FA77A" />
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.masterTitle}>All Notifications</Text>
              <Text style={styles.masterSub}>Enable or disable everything at once</Text>
            </View>
          </View>
          <Switch
            value={allEnabled}
            onValueChange={toggleAll}
            trackColor={{ false: '#e5e7eb', true: '#1FA77A' }}
            thumbColor="#fff"
          />
        </View>

        {/* Preference groups */}
        {NOTIFICATION_GROUPS.map(group => (
          <View key={group.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.card}>
              {group.items.map((item, index) => (
                <View key={item.id}>
                  <View style={styles.row}>
                    <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                      <MCIcon name={item.icon} size={20} color={item.iconColor} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowSub}>{item.subtitle}</Text>
                    </View>
                    <Switch
                      value={allEnabled ? enabled[item.id] : false}
                      onValueChange={() => toggle(item.id)}
                      disabled={!allEnabled}
                      trackColor={{ false: '#e5e7eb', true: '#1FA77A' }}
                      thumbColor="#fff"
                    />
                  </View>
                  {index < group.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Recent */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          <View style={styles.card}>
            {RECENT_NOTIFICATIONS.map((n, index) => (
              <View key={n.id}>
                <View style={styles.notifRow}>
                  <View style={[styles.notifIcon, { backgroundColor: n.bg }]}>
                    <MCIcon name={n.icon} size={20} color={n.color} />
                  </View>
                  <View style={styles.notifInfo}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifBody}>{n.body}</Text>
                    <Text style={styles.notifTime}>{n.time}</Text>
                  </View>
                </View>
                {index < RECENT_NOTIFICATIONS.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#1FA77A',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle:    { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  masterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 20,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  masterLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  masterTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  masterSub:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  section:      { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10, marginLeft: 4 },

  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 66 },

  row:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  rowInfo: { flex: 1 },
  rowTitle:{ fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowSub:  { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  notifRow:  { flexDirection: 'row', padding: 14, alignItems: 'flex-start' },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifInfo: { flex: 1 },
  notifTitle:{ fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  notifBody: { fontSize: 12, color: '#6b7280', lineHeight: 18 },
  notifTime: { fontSize: 11, color: '#9ca3af', marginTop: 5 },
});
