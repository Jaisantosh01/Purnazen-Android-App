import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ListSkeleton } from '../components/SkeletonLoader';
import Avatar from '../components/Avatar';
import useTheme from '../hooks/useTheme';
import { showAlert, showConfirm } from '../utils/alert';

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback((pageNum = 1, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);

    const params = { page: pageNum, per_page: 20 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (selectedRole !== 'All') params.role = selectedRole;

    const promises = [apiClient.get(ENDPOINTS.USERS, { params })];
    if (pageNum === 1) promises.push(apiClient.get(ENDPOINTS.ROLES));

    Promise.all(promises)
      .then(([usersRes, rolesRes]) => {
        const newUsers = usersRes?.data?.users || [];
        setUsers(prev => append ? [...prev, ...newUsers] : newUsers);
        setHasMore(pageNum < (usersRes?.data?.total_pages || 0));
        setPage(pageNum);
        if (rolesRes) {
          setRoles([{ name: 'All', icon: 'account-group' }, ...(rolesRes?.data || [])]);
        }
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        setUsers([]);
      })
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [debouncedSearch, selectedRole]);

  useFocusEffect(
    useCallback(() => {
      fetchData(1);
    }, [fetchData])
  );

  const handleEdit = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    navigation.navigate('EditUser', { user: item });
  };

  const handleDelete = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    // Themed dialog (AppAlertHost) rather than the OS Alert, so the confirm
    // follows the app theme like every other destructive action.
    showConfirm(
      'Delete User',
      `Delete ${item.full_name}? They are signed out immediately and can no ` +
        `longer log in. Their appointments and records are kept, so you can ` +
        `restore the account later.`,
      () => {
        apiClient.delete(`${ENDPOINTS.USERS}/${item.id}`)
          .then(() => { showAlert('Success', 'User deleted'); fetchData(); })
          .catch(err => showAlert('Error', err?.message || 'Failed to delete user'));
      },
      { confirmLabel: 'Delete', destructive: true },
    );
  };

  const handleRestore = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    apiClient.put(`${ENDPOINTS.USERS}/${item.id}`, { is_active: true })
      .then(() => { showAlert('Success', 'User restored'); fetchData(); })
      .catch(err => showAlert('Error', err?.message || 'Failed to restore user'));
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchData(page + 1, true);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header removed from here as it is now in UnifiedUserDoctorScreen */}

      {loading && users.length === 0 ? (
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
        data={users}
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
          const isInactive = item.is_active === false;
          return (
            <TouchableOpacity
              style={[styles.userCard, isInactive && styles.userCardInactive]}
              activeOpacity={1}
              onPress={() => navigation.navigate('EditUser', { user: item })}
            >
              <Avatar
                uri={item.avatar_url}
                name={item.full_name}
                size={48}
                backgroundColor={colors.primaryLight}
                style={styles.avatarSpacing}
              />
              <View style={styles.userCardContent}>
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName}>{item.full_name}</Text>
                  {isInactive && (
                    <View style={styles.inactivePill}>
                      <Text style={styles.inactivePillText}>Deleted</Text>
                    </View>
                  )}
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
            {data.item.is_active === false ? (
              <TouchableOpacity style={[styles.backBtn, styles.restoreBack]} onPress={() => handleRestore(data.item, rowMap)}>
                <MCIcon name="account-reactivate" size={22} color="#fff" />
                <Text style={styles.backBtnText}>Restore</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => handleDelete(data.item, rowMap)}>
                <MCIcon name="delete" size={22} color="#fff" />
                <Text style={styles.backBtnText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={() => fetchData(1)}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : null}
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
  userCardInactive: { backgroundColor: colors.surfaceMuted, borderColor: colors.borderStrong },
  avatarSpacing: { marginRight: 16 },
  userCardContent: { flex: 1, marginRight: 12 },
  userNameContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  userName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  userEmail: { fontSize: 13, color: colors.textMuted },
  inactivePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#EF444422',
  },
  inactivePillText: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
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
  restoreBack: {
    backgroundColor: '#10B981',
  },
  backBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
});

export default UserManagementScreen;
