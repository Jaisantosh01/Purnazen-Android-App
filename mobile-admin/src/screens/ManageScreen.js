import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';

const ManageScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const GROUPS = [
    {
      title: 'People',
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
      items: [
        {
          icon: 'video-outline',
          title: 'Wellness Videos',
          subtitle: 'Manage wellness video content',
          screen: 'VideoManagement',
        },
        {
          icon: 'help-circle-outline',
          title: 'FAQ Management',
          subtitle: 'Configure FAQ content',
          screen: 'FaqManagement',
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
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Manage"
        subtitle="All management areas in one place"
        showBack={false}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
                    <View style={styles.iconCircle}>
                      <MCIcon name={item.icon} size={24} color={colors.primary} />
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
  scrollContent: { padding: 16, paddingBottom: 32 },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 76,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontWeight: '500' },
});

export default ManageScreen;
