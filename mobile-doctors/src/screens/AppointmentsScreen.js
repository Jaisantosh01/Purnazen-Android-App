import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import Placeholder from '../components/Placeholder';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const AppointmentsScreen = ({ navigation }) => (
  <View style={styles.root}>
    <ScreenHeader
      title="Appointments"
      right={
        <TouchableOpacity onPress={() => navigation.navigate('AppointmentDetail', { id: 'sample' })}>
          <MCIcon name="open-in-new" size={22} color={COLORS.white} />
        </TouchableOpacity>
      }
    />
    <Placeholder
      icon="calendar-check"
      title="Your appointments"
      description="Upcoming and past consultations with patients will appear here."
      features={[
        'List today / upcoming / past appointments',
        'Accept, reschedule or mark complete',
        'Open a patient profile from an appointment',
      ]}
      endpoint="GET /api/v1/appointments  (doctor-scoped list — TODO on backend)"
    />
    <TouchableOpacity
      style={styles.demoBtn}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('AppointmentDetail', { id: 'sample' })}>
      <Text style={styles.demoBtnText}>Open sample appointment</Text>
    </TouchableOpacity>
  </View>
);

export default AppointmentsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  demoBtn: {
    margin: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  demoBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
