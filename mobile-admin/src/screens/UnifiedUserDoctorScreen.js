import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../constants/theme';
import UserManagementScreen from './UserManagementScreen';
import DoctorManagementScreen from './DoctorManagementScreen';
import { ENDPOINTS } from '../constants/apiEndpoints';

const UnifiedUserDoctorScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header with Title and Action Icon */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Management</Text>
        {activeTab === 'users' ? (
          <TouchableOpacity 
            style={styles.manageBtn} 
            onPress={() => navigation.navigate('ManageRoles', { title: 'Roles', endpoint: ENDPOINTS.ROLES })}
          >
            <MCIcon name="account-cog" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.manageBtn}
            onPress={() => navigation.navigate('EditDoctor', { doctorId: null })}
          >
            <MCIcon name="plus" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    paddingTop: 12, 
    paddingHorizontal: 12, 
    paddingBottom: 16, 
    backgroundColor: COLORS.white, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  manageBtn: { padding: 4 },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  content: { flex: 1 }
});

export default UnifiedUserDoctorScreen;
