import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
import { ListSkeleton } from '../components/SkeletonLoader';

const ROLE_COLORS = {
  'admin': '#FF4D4D',
  'doctor': '#4A90E2',
  'patient': '#50C878'
};

const UserManagementScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  
  // Menu state
  const [menuVisible, setMenuVisible] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 20 });
  const [isMenuOpenTop, setIsMenuOpenTop] = useState(false);
  const menuButtonRefs = useRef({});

  useEffect(() => {
    fetchData();
  }, []);

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

  const openMenu = (userId) => {
    menuButtonRefs.current[userId]?.measure((x, y, width, height, pageX, pageY) => {
      const screenHeight = 800; // Approximate
      const showTop = pageY > screenHeight / 2;
      setMenuPosition({ top: showTop ? pageY - 100 : pageY + height });
      setIsMenuOpenTop(showTop);
      setMenuVisible(userId);
    });
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

      {loading && filteredUsers.length === 0 ? (
        <View>
          <View style={styles.searchContainer}>
            <MCIcon name="magnify" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or email..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          <ListSkeleton count={5} />
        </View>
      ) : (
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
                placeholderTextColor={COLORS.textMuted}
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
                      color={isSelected ? COLORS.white : roleColor} 
                      style={{marginRight: 6}} 
                    />
                    <Text style={[styles.tabText, isSelected && { color: COLORS.white }]}>{role.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        }
        renderItem={({ item }) => {
          const roleData = roles.find(r => r.name.toLowerCase() === (item.role || '').toLowerCase());
          return (
            <View style={styles.userCard}>
              <View style={[styles.avatar, { backgroundColor: COLORS.primaryLight }]}>
                  <MCIcon name={roleData?.icon || 'account'} size={28} color={COLORS.primary} />
              </View>
              <View style={styles.userCardContent}>
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName}>{item.full_name}</Text>
                </View>
                <Text style={styles.userEmail}>{item.email}</Text>
              </View>
              <TouchableOpacity 
                ref={(ref) => menuButtonRefs.current[item.id] = ref}
                onPress={() => openMenu(item.id)} 
                style={styles.menuButton}
              >
                <MCIcon name="dots-vertical" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
              
              <Modal transparent visible={menuVisible === item.id} onRequestClose={() => setMenuVisible(null)}>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setMenuVisible(null)} activeOpacity={1}>
                  <View style={[styles.menu, { top: menuPosition.top, right: 12 }]}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(null); navigation.navigate('EditUser', { user: item }); }}>
                      <MCIcon name="pencil" size={18} color={COLORS.primary} />
                      <Text style={styles.menuItemText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(null); Alert.alert('Delete', 'Delete user coming soon'); }}>
                      <MCIcon name="delete" size={18} color="#FF4D4D" />
                      <Text style={[styles.menuItemText, { color: '#FF4D4D' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          );
        }}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={fetchData}
      />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { 
    paddingTop: 56, 
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
  searchContainer: { 
    marginHorizontal: 12, 
    marginTop: 16,
    marginBottom: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.white, 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    height: 48, 
    borderWidth: 1, 
    borderColor: '#eee' 
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  tabsContainer: { paddingHorizontal: 12, marginBottom: 16 },
  tabsContent: { gap: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, backgroundColor: '#f5f5f5' },
  tabText: { fontWeight: '600', color: COLORS.textSecondary },
  listContainer: { paddingHorizontal: 12, paddingBottom: 16 },
  userCard: { 
    backgroundColor: COLORS.white, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12, 
    marginHorizontal: 12,
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#f0f0f0' 
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  userCardContent: { flex: 1, marginRight: 12 },
  userNameContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  userEmail: { fontSize: 13, color: COLORS.textMuted },
  menuButton: { padding: 4 },
  menu: { position: 'absolute', backgroundColor: COLORS.white, borderRadius: 8, padding: 8, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, zIndex: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  menuItemText: { fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'transparent' }
});

export default UserManagementScreen;
