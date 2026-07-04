import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Placeholder from '../components/Placeholder';
import useTheme from '../hooks/useTheme';

const AppointmentDetailScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const id = route?.params?.id ?? 'unknown';
  return (
    <View style={styles.root}>
      <ScreenHeader title="Appointment" subtitle={`#${id}`} onBack={() => navigation.goBack()} />
      <Placeholder
        icon="clipboard-text-clock-outline"
        title="Appointment detail"
        description="Patient, time, visit type and status — with actions to manage the consultation."
        features={[
          'Patient summary + reason for visit',
          'Accept / reschedule / complete / cancel',
          'Jump to the patient profile & scan history',
        ]}
        endpoint="GET /api/v1/appointments/:id · PUT /api/v1/appointments/:id"
      />
    </View>
  );
};

export default AppointmentDetailScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
