import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ListSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import { showAlert } from '../utils/alert';

const ROLE_COLORS = {
  'admin': '#FF4D4D',
  'doctor': '#4A90E2',
  'patient': '#50C878'
};

const UserManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiClient.get(ENDPOINTS.USERS),
      apiClient.get(ENDPOINTS.ROLES),
    ])
      .then(([usersRes, rolesRes]) => {
        setUsers(usersRes?.data || []);
        setRoles([{ name: 'All', icon: 'account-group' }, ...(rolesRes?.data || [])]);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setUsers([]);
        setRoles([{ name: 'All', icon: 'account-group' }]);
      })
      .finally(() => setLoading(false));
  };

  const handleEdit = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    navigation.navigate('EditUser', { user: item });
  };

  const handleDelete = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    Alert.alert('Delete User', `Are you sure you want to delete ${item.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        apiClient.delete(`${ENDPOINTS.USERS}/${item.id}`)
          .then(() => { showAlert('Success', 'User deleted'); fetchData(); })
          .catch(() => showAlert('Error', 'Failed to delete user'));
      }},
    ]);
  };

  const filteredUsers = users.filter(u => 
    (selectedRole === 'All' || (u.role && u.role.toLowerCase() === selectedRole.toLowerCase())) &&
    (u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={styles.root}>
      {/* Header removed from here as it is now in UnifiedUserDoctorScreen */}

      {loading && filteredUsers.length === 0 ? (
        <View>
          <View style={styles.searchContainer}>
            <MCIcon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <ListSkeleton count={5} />
        </View>
      ) : (
      <SwipeListView
        data={filteredUsers}
        keyExtractor={item => item.id.toString()}
        leftOpenValue={80}
        rightOpenValue={-80}
        disableRightSwipe={false}
        ListHeaderComponent={
          <>
            <View style={styles.searchContainer}>
              <MCIcon name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsContent}>
              {roles.map(role => {
                const roleColor = ROLE_COLORS[role.name.toLowerCase()] || '#666';
                const isSelected = selectedRole === role.name;
                return (
                  <TouchableOpacity 
                    key={role.name}
                    style={[
                      styles.tab, 
                      { borderColor: roleColor },
                      isSelected && { backgroundColor: roleColor }
                    ]}
                    onPress={() => setSelectedRole(role.name)}
                  >
                    <MCIcon 
                      name={role.icon} 
                      size={18} 
                      color={isSelected ? colors.white : roleColor} 
                      style={{marginRight: 6}} 
                    />
                    <Text style={[styles.tabText, isSelected && { color: colors.white }]}>{role.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => {
          const roleData = roles.find(r => r.name.toLowerCase() === (item.role || '').toLowerCase());
          return (
            <TouchableOpacity
              style={styles.userCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('EditUser', { user: item })}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                  <MCIcon name={roleData?.icon || 'account'} size={28} color={colors.primary} />
              </View>
              <View style={styles.userCardContent}>
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName}>{item.full_name}</Text>
                </View>
                <Text style={styles.userEmail}>{item.email}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        renderHiddenItem={(data, rowMap) => (
          <View style={styles.rowBack}>
            <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => handleEdit(data.item, rowMap)}>
              <MCIcon name="pencil" size={22} color="#fff" />
              <Text style={styles.backBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => handleDelete(data.item, rowMap)}>
              <MCIcon name="delete" size={22} color="#fff" />
              <Text style={styles.backBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={fetchData}
        closeOnRowPress={true}
        closeOnRowOpen={true}
        closeOnRowBeginSwipe={true}
      />
      )}
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { 
    paddingTop: 12, 
    paddingHorizontal: 12, 
    paddingBottom: 16, 
    backgroundColor: colors.card, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  manageBtn: { padding: 4 },
  searchContainer: { 
    marginHorizontal: 12, 
    marginTop: 16,
    marginBottom: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.card, 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    height: 48, 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  tabsContainer: { paddingHorizontal: 12, marginBottom: 16 },
  tabsContent: { gap: 10, paddingRight: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, backgroundColor: colors.surfaceMuted },
  tabText: { fontWeight: '600', color: colors.textSecondary },
  list: { flex: 1 },
  listContainer: { paddingHorizontal: 12, paddingBottom: 16 },
  userCard: { 
    backgroundColor: colors.card, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    marginHorizontal: 12,
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  userCardContent: { flex: 1, marginRight: 12 },
  userNameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  userName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  userEmail: { fontSize: 13, color: colors.textMuted },
  rowBack: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    width: 75,
    height: '100%',
  },
  editBack: {
    backgroundColor: '#3B82F6',
  },
  deleteBack: {
    backgroundColor: '#EF4444',
  },
  backBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default UserManagementScreen;
