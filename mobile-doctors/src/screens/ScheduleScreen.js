import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Placeholder from '../components/Placeholder';
import { COLORS } from '../constants/theme';

const ScheduleScreen = () => (
  <View style={styles.root}>
    <ScreenHeader title="My schedule" subtitle="Availability & time slots" />
    <Placeholder
      icon="calendar-clock"
      title="Manage your availability"
      description="Define the weekly slots patients can book. Backed by the doctor-availability API."
      features={[
        'View weekly availability by day',
        'Add / edit / remove slots (start, end, duration)',
        'Block out dates & set slot length',
      ]}
      endpoint="GET·POST /api/v1/doctor-availability · PUT·DELETE /doctor-availability/:id"
    />
  </View>
);

export default ScheduleScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
});
