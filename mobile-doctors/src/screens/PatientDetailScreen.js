import React from 'react';
import { View, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Placeholder from '../components/Placeholder';
import { COLORS } from '../constants/theme';

const PatientDetailScreen = ({ navigation, route }) => {
  const id = route?.params?.id ?? 'unknown';
  return (
    <View style={styles.root}>
      <ScreenHeader title="Patient" subtitle={`#${id}`} onBack={() => navigation.goBack()} />
      <Placeholder
        icon="account-heart-outline"
        title="Patient profile"
        description="Demographics, consultation history and face/tongue scan results."
        features={[
          'Profile & contact summary',
          'Past appointments with this patient',
          'Face-glow scan history, scores & trends',
        ]}
        endpoint="GET /api/v1/patients/:id · GET /patients/:id/face-glow/history"
      />
    </View>
  );
};

export default PatientDetailScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
});
