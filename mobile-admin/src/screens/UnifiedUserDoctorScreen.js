import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import UserManagementScreen from './UserManagementScreen';
import DoctorManagementScreen from './DoctorManagementScreen';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const UnifiedUserDoctorScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState('users');

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Users & Doctors"
        subtitle={activeTab === 'users' ? 'Manage app users and their roles' : 'Manage doctors and their profiles'}
        right={activeTab === 'users' ? (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.navigate('ManageRoles', { title: 'Roles', endpoint: ENDPOINTS.ROLES })}
          >
            <MCIcon name="account-cog" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => navigation.navigate('EditDoctor', { doctorId: null })}
          >
            <MCIcon name="plus" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      />

      {/* Top Tab Bar */}
      <View style={styles.topTabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'users' && styles.activeTab]} 
          onPress={() => setActiveTab('users')}
        >
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'doctors' && styles.activeTab]} 
          onPress={() => setActiveTab('doctors')}
        >
          <Text style={[styles.tabText, activeTab === 'doctors' && styles.activeTabText]}>Doctors</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'users' ? (
          <UserManagementScreen navigation={navigation} />
        ) : (
          <DoctorManagementScreen navigation={navigation} />
        )}
      </View>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  manageBtn: { padding: 4 },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.primary,
  },
  content: { flex: 1 }
});

export default UnifiedUserDoctorScreen;
