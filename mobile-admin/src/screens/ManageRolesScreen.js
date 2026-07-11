import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const ManageRolesScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <ScreenHeader title="Manage Roles" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <Text style={styles.text}>Role management functionality coming soon.</Text>
      </View>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, alignItems: 'center', justifyContent: 'center', flex: 1 },
  text: { color: colors.textMuted }
});

export default ManageRolesScreen;
