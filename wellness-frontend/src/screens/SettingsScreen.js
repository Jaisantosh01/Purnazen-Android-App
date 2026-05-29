import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 64 },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  settingTitleDanger: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  settingSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  valueText: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },

  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#d1d5db',
    marginTop: 28,
  },
});

const SectionHeader = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

const ToggleRow = ({ icon, iconColor = '#1FA77A', iconBg = '#e8f8f2', title, subtitle, value, onToggle }) => (
  <View style={styles.settingRow}>
    <View style={[styles.settingIconBox, { backgroundColor: iconBg }]}>
      <MCIcon name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingInfo}>
      <Text style={styles.settingTitle}>{title}</Text>
      {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#e5e7eb', true: '#1FA77A' }}
      thumbColor="#fff"
    />
  </View>
);

const ArrowRow = ({ icon, iconColor = '#1FA77A', iconBg = '#e8f8f2', title, subtitle, onPress, valueText, danger }) => (
  <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
    <View style={[styles.settingIconBox, { backgroundColor: iconBg }]}>
      <MCIcon name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingInfo}>
      <Text style={danger ? styles.settingTitleDanger : styles.settingTitle}>{title}</Text>
      {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
    </View>
    {valueText
      ? <Text style={styles.valueText}>{valueText}</Text>
      : <MCIcon name="chevron-right" size={20} color="#d1d5db" />}
  </TouchableOpacity>
);

const SettingsScreen = ({ navigation }) => {
  const [notifications, setNotifications]         = useState(true);
  const [sessionReminders, setSessionReminders]   = useState(true);
  const [appointmentAlerts, setAppointmentAlerts] = useState(true);
  const [promotionalEmails, setPromotionalEmails] = useState(false);
  const [darkMode, setDarkMode]                   = useState(false);
  const [biometric, setBiometric]                 = useState(false);
  const [locationAccess, setLocationAccess]       = useState(true);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Request sent to support.') },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your preferences</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Account */}
        <View style={styles.section}>
          <SectionHeader title="Account" />
          <View style={styles.card}>
            <ArrowRow
              icon="account-edit-outline"
              title="Edit Profile"
              subtitle="Update name, photo & bio"
              onPress={() => Alert.alert('Edit Profile', 'Coming soon!')}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="lock-outline"
              iconColor="#7c3aed"
              iconBg="#F3EEFF"
              title="Change Password"
              subtitle="Update your login password"
              onPress={() => Alert.alert('Change Password', 'A reset link will be sent to your email.')}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="phone-outline"
              iconColor="#0284c7"
              iconBg="#E0F2FE"
              title="Phone Number"
              subtitle="Linked mobile number"
              valueText="+91 98765 XXXXX"
              onPress={() => Alert.alert('Update Phone', 'Coming soon!')}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="email-outline"
              iconColor="#f59e0b"
              iconBg="#FFFBEB"
              title="Email Address"
              subtitle="Linked email"
              valueText="john@email.com"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <SectionHeader title="Notifications" />
          <View style={styles.card}>
            <ToggleRow
              icon="bell-outline"
              title="Push Notifications"
              subtitle="Enable all app notifications"
              value={notifications}
              onToggle={setNotifications}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="yoga"
              iconColor="#7c3aed"
              iconBg="#F3EEFF"
              title="Session Reminders"
              subtitle="Daily wellness session alerts"
              value={sessionReminders}
              onToggle={setSessionReminders}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="calendar-clock"
              iconColor="#0284c7"
              iconBg="#E0F2FE"
              title="Appointment Alerts"
              subtitle="Reminders before consultations"
              value={appointmentAlerts}
              onToggle={setAppointmentAlerts}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="tag-outline"
              iconColor="#f59e0b"
              iconBg="#FFFBEB"
              title="Promotional Emails"
              subtitle="Offers, tips & newsletters"
              value={promotionalEmails}
              onToggle={setPromotionalEmails}
            />
          </View>
        </View>

        {/* Appearance & Security */}
        <View style={styles.section}>
          <SectionHeader title="Appearance & Security" />
          <View style={styles.card}>
            <ToggleRow
              icon="weather-night"
              iconColor="#6b7280"
              iconBg="#f3f4f6"
              title="Dark Mode"
              subtitle="Switch to dark theme"
              value={darkMode}
              onToggle={setDarkMode}
            />
            <View style={styles.rowDivider} />
            <ToggleRow
              icon="fingerprint"
              iconColor="#1FA77A"
              iconBg="#e8f8f2"
              title="Biometric Login"
              subtitle="Use fingerprint or face ID"
              value={biometric}
              onToggle={setBiometric}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="translate"
              iconColor="#ea580c"
              iconBg="#FFF3E0"
              title="Language"
              subtitle="App display language"
              valueText="English"
              onPress={() => Alert.alert('Language', 'More languages coming soon!')}
            />
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <SectionHeader title="Privacy" />
          <View style={styles.card}>
            <ToggleRow
              icon="map-marker-outline"
              iconColor="#D46F6F"
              iconBg="#FFEEEE"
              title="Location Access"
              subtitle="Used for nearby doctor search"
              value={locationAccess}
              onToggle={setLocationAccess}
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="download-outline"
              iconColor="#0284c7"
              iconBg="#E0F2FE"
              title="Download My Data"
              subtitle="Export your health records"
              onPress={() => Alert.alert('Download Data', 'Your data export will be emailed within 24 hours.')}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <SectionHeader title="Danger Zone" />
          <View style={styles.card}>
            <ArrowRow
              icon="logout"
              iconColor="#ef4444"
              iconBg="#FFF5F5"
              title="Logout"
              onPress={() =>
                Alert.alert('Logout', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Logout', style: 'destructive', onPress: () => {} },
                ])
              }
            />
            <View style={styles.rowDivider} />
            <ArrowRow
              icon="delete-outline"
              iconColor="#ef4444"
              iconBg="#FFF5F5"
              title="Delete Account"
              subtitle="Permanently remove all your data"
              onPress={handleDeleteAccount}
              danger
            />
          </View>
        </View>

        <Text style={styles.version}>M-Heal v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
