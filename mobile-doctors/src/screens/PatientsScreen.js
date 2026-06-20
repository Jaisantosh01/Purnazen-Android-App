import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Placeholder from '../components/Placeholder';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const PatientsScreen = ({ navigation }) => (
  <View style={styles.root}>
    <ScreenHeader title="Patients" />
    <Placeholder
      icon="account-multiple"
      title="Your patients"
      description="People you've consulted with — search, view profiles and their scan history."
      features={[
        'Search & list patients',
        'Open a patient profile',
        'Review face/tongue scan history & trends',
      ]}
      endpoint="GET /api/v1/patients  (doctor-scoped — TODO on backend)"
    />
    <TouchableOpacity
      style={styles.demoBtn}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('PatientDetail', { id: 'sample' })}>
      <Text style={styles.demoBtnText}>Open sample patient</Text>
    </TouchableOpacity>
  </View>
);

export default PatientsScreen;

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
