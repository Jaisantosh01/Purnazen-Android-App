import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';

const ROLES = [
  { name: 'All', color: '#666' },
  { name: 'admin', color: '#FF4D4D' },
  { name: 'doctor', color: '#4A90E2' },
  { name: 'patient', color: '#50C878' },
];

const UserManagementScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [menuVisible, setMenuVisible] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    apiClient
      .get(ENDPOINTS.USERS)
      .then(res => setUsers(res?.data || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  const filteredUsers = users.filter(u => 
    (selectedRole === 'All' || (u.role && u.role.toLowerCase() === selectedRole.toLowerCase())) &&
    (u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Management</Text>
        <TouchableOpacity style={styles.manageBtn} onPress={() => navigation.navigate('ManageRoles', { title: 'Roles', endpoint: ENDPOINTS.ROLES })}>
            <MCIcon name="account-cog" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={
          <>
            <View style={styles.searchContainer}>
              <MCIcon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or email..."
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsContent}>
              {ROLES.map(role => (
                <TouchableOpacity 
                  key={role.name}
                  style={[
                    styles.tab, 
                    selectedRole === role.name && { borderColor: role.color, borderWidth: 2, backgroundColor: role.color + '10' }
                  ]}
                  onPress={() => setSelectedRole(role.name)}
                >
                  <Text style={[styles.tabText, selectedRole === role.name && { color: role.color }]}>{role.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => {
          const roleColor = ROLES.find(r => r.name.toLowerCase() === (item.role || '').toLowerCase())?.color || '#ccc';
          return (
            <View style={[styles.userCard, { borderColor: roleColor, borderWidth: 1 }]}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.full_name}</Text>
                <Text style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userRole}>Role: {item.role || 'N/A'}</Text>
              </View>
              <TouchableOpacity onPress={() => setMenuVisible(menuVisible === item.id ? null : item.id)}>
                <MCIcon name="dots-vertical" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
              {menuVisible === item.id && (
                <View style={styles.menu}>
                  <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Edit', 'Edit user coming soon')}>
                    <MCIcon name="pencil" size={18} color={COLORS.primary} />
                    <Text style={styles.menuItemText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Delete', 'Delete user coming soon')}>
                    <MCIcon name="delete" size={18} color="#FF4D4D" />
                    <Text style={[styles.menuItemText, { color: '#FF4D4D' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={fetchUsers}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    paddingTop: 56, 
    paddingHorizontal: 20, 
    paddingBottom: 16, 
    backgroundColor: COLORS.white, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  searchContainer: { 
    marginHorizontal: 16, 
    marginTop: 16,
    marginBottom: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.white, 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    height: 44, 
    borderWidth: 1, 
    borderColor: '#eee' 
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  tabsContainer: { paddingHorizontal: 16, marginBottom: 16 },
  tabsContent: { gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  tabText: { fontWeight: '600' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  userCard: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700' },
  userEmail: { fontSize: 13, color: COLORS.textMuted },
  userRole: { fontSize: 13, color: COLORS.primary, marginTop: 4 },
  editBtn: { padding: 8 },
  menu: { position: 'absolute', right: 40, top: 16, backgroundColor: COLORS.white, borderRadius: 8, padding: 8, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, zIndex: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  menuItemText: { fontSize: 14, fontWeight: '500' },
});

export default UserManagementScreen;
