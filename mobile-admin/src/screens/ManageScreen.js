import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import TabHeader from '../components/TabHeader';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';

const ManageScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const GROUPS = [
    {
      title: 'People',
      hue: '#7C3AED',
      items: [
        {
          icon: 'account-group-outline',
          title: 'Users & Doctors',
          subtitle: 'Manage users, doctors and roles',
          screen: 'UsersAndDoctorsMain',
        },
        {
          icon: 'star-outline',
          title: 'Expertise',
          subtitle: 'Manage doctor expertise areas',
          screen: 'ManageExpertise',
          params: { title: 'Expertise', endpoint: ENDPOINTS.EXPERTISES },
        },
        {
          icon: 'translate',
          title: 'Languages',
          subtitle: 'Manage doctor languages',
          screen: 'ManageLanguages',
          params: { title: 'Languages', endpoint: ENDPOINTS.LANGUAGES },
        },
        {
          icon: 'card-text-outline',
          title: 'Specialties',
          subtitle: 'Manage doctor specialties',
          screen: 'ManageSpecialties',
          params: { title: 'Specialties', endpoint: ENDPOINTS.SPECIALTIES },
        },
      ],
    },
    {
      title: 'Scheduling',
      hue: '#2563EB',
      items: [
        {
          icon: 'calendar-clock-outline',
          title: 'Appointments',
          subtitle: 'View and manage appointments',
          screen: 'AppointmentsMain',
        },
        {
          icon: 'clock-outline',
          title: 'Time Slots',
          subtitle: 'Configure available time slots',
          screen: 'SlotManagement',
        },
        {
          icon: 'beach',
          title: 'Doctor Leaves',
          subtitle: 'Review and approve leave requests',
          screen: 'DoctorLeaveManagement',
        },
      ],
    },
    {
      title: 'Content',
      hue: '#0D9488',
      items: [
        {
          icon: 'video-outline',
          title: 'Wellness Videos',
          subtitle: 'Manage wellness video content',
          screen: 'VideoManagement',
        },
        {
          icon: 'view-grid-plus-outline',
          title: 'Quick Relief Cards',
          subtitle: 'Shortcuts on the patient Home screen',
          screen: 'QuickReliefManagement',
        },
        {
          icon: 'help-circle-outline',
          title: 'FAQ Management',
          subtitle: 'Configure FAQ content',
          screen: 'FaqManagement',
        },
        {
          icon: 'lifebuoy',
          title: 'Support Contacts',
          subtitle: 'Phone, WhatsApp and email in Help & Support',
          screen: 'SupportContacts',
        },
        {
          icon: 'bell-cog-outline',
          title: 'Notifications',
          subtitle: 'Broadcasts, switches & reminders',
          screen: 'NotificationAdmin',
        },
        {
          icon: 'file-document-edit-outline',
          title: 'Content Pages',
          subtitle: 'Edit in-app pages and policies',
          screen: 'ContentManagement',
        },
      ],
    },
    {
      title: 'Patients',
      hue: '#D97706',
      items: [
        {
          icon: 'message-reply-text-outline',
          title: 'Patient Feedback',
          subtitle: 'Session remarks and pain scores to review',
          screen: 'FeedbackReview',
        },
      ],
    },
    {
      title: 'Billing',
      hue: '#16A34A',
      items: [
        {
          icon: 'percent-outline',
          title: 'GST',
          subtitle: 'Set the tax applied to consultation fees',
          screen: 'TaxSettings',
        },
      ],
    },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TabHeader title="Manage" subtitle="All management areas in one place" />

        {GROUPS.map(group => (
          <View key={group.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title}</Text>
            <View style={styles.groupCard}>
              {group.items.map((item, idx) => (
                <React.Fragment key={item.screen}>
                  {idx > 0 && <View style={styles.divider} />}
                  <TouchableOpacity
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate(item.screen, item.params)}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: `${group.hue}22` }]}>
                      <MCIcon name={item.icon} size={22} color={group.hue} />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowSub}>{item.subtitle}</Text>
                    </View>
                    <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 32 },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});

export default ManageScreen;
