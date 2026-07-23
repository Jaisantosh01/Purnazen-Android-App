import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { CONTENT_TABS } from '../constants/content';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const ContentManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [pages, setPages] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('terms');
  const [filterRoleId, setFilterRoleId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRolePicker, setFilterRolePicker] = useState(false);

  useEffect(() => { fetchRoles(); }, []);

  const fetchPages = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filterRoleId) params.role_id = filterRoleId;
    if (filterStatus === 'active') params.is_active = true;
    else if (filterStatus === 'inactive') params.is_active = false;
    apiClient.get(ENDPOINTS.CONTENT_PAGES, { params })
      .then(res => setPages(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, [filterRoleId, filterStatus]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const fetchRoles = () => {
    apiClient.get(ENDPOINTS.ROLES)
      .then(res => setRoles(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  };

  const getPagesByType = useCallback((type) =>
    pages.filter(p => p.type === type).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [pages]);

  const getRoleName = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : roleId;
  };

  const handleDelete = (id, rowMap) => {
    if (rowMap?.[id]) rowMap[id].closeRow();
    Alert.alert('Deactivate', 'Are you sure?', [
      { text: 'Cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: () => {
        apiClient.delete(`${ENDPOINTS.CONTENT_PAGES}/${id}`).then(fetchPages).catch(() => Alert.alert('Error', 'Failed to deactivate'));
      }},
    ]);
  };

  const handleCardPress = (item) => navigation.navigate('ContentDetail', { item });

  const openAddModal = () => {
    navigation.navigate('ContentEditor', { initialType: activeTab, roles });
  };

  const startEdit = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    navigation.navigate('ContentEditor', { editingItem: item, initialType: item.type, roles });
  };

  const activeItems = getPagesByType(activeTab);

  const renderItem = ({ item }) => {
    const isInactive = item.isActive === false;
    const colorStyle = isInactive ? colors.textMuted : colors.textPrimary;
    return (
      <TouchableOpacity style={[styles.card, isInactive && styles.cardInactive]} onPress={() => handleCardPress(item)} activeOpacity={0.95}>
        <View style={styles.cardHeader}>
          <MCIcon name={item.type === 'terms' ? 'file-document-outline' : 'shield-lock-outline'} size={18} color={colorStyle} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colorStyle }]} numberOfLines={1}>{item.title || item.type}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.cardMeta}>v{item.version || '1.0'}</Text>
              <View style={[styles.roleChip, { backgroundColor: colors.primaryFaint }]}>
                <MCIcon name="account" size={10} color={colors.textSecondary} />
                <Text style={styles.roleChipText}>{item.roleName || 'Unknown'}</Text>
              </View>
              {!item.isActive && <Text style={{ fontSize: 10, color: colors.danger || '#EF4444', fontWeight: '600' }}>Inactive</Text>}
            </View>
          </View>
          <MCIcon name="chevron-right" size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderHiddenItem = (data, rowMap) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => startEdit(data.item, rowMap)}>
        <MCIcon name="pencil" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => handleDelete(data.item.id, rowMap)}>
        <MCIcon name="delete" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Content Management"
        subtitle="Terms, conditions & privacy policies"
        onBack={() => navigation.goBack()}
        underColor={colors.card}
        right={
          <TouchableOpacity onPress={openAddModal} style={{ padding: 4 }}>
            <MCIcon name="plus" size={24} color={colors.headerText} />
          </TouchableOpacity>
        }
      />

      <View style={styles.tabBar}>
        {CONTENT_TABS.map(tab => {
          const isActiveTab = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={[styles.tab, isActiveTab && styles.tabActive]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
              <MCIcon name={tab.icon} size={16} color={isActiveTab ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabLabel, isActiveTab && styles.tabLabelActive]} numberOfLines={1}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity style={styles.filterPicker} onPress={() => setFilterRolePicker(true)}>
          <MCIcon name="account-filter" size={16} color={colors.textSecondary} />
          <Text style={styles.filterPickerText} numberOfLines={1}>{filterRoleId ? getRoleName(filterRoleId) : 'All Roles'}</Text>
          <MCIcon name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.statusFilter}>
          {['all', 'active', 'inactive'].map(s => (
            <TouchableOpacity key={s} style={[styles.statusBtn, filterStatus === s && styles.statusBtnActive]}
              onPress={() => setFilterStatus(s)}>
              <Text style={[styles.statusBtnText, filterStatus === s && styles.statusBtnTextActive]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeItems.length === 0 && !loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.emptyText}>No content yet. Tap + to add.</Text>
        </View>
      ) : (
        <SwipeListView
          data={activeItems}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderHiddenItem={renderHiddenItem}
          leftOpenValue={75}
          rightOpenValue={-75}
          stopLeftSwipe={130}
          stopRightSwipe={-130}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshing={loading}
          onRefresh={fetchPages}
          closeOnRowOpen
          closeOnRowPress
        />
      )}

      <Modal visible={filterRolePicker} transparent={true} animationType="fade" onRequestClose={() => setFilterRolePicker(false)}>
        <TouchableOpacity style={styles.pickerModalOverlay} activeOpacity={1} onPress={() => setFilterRolePicker(false)}>
          <View style={styles.pickerModalContent}>
            <Text style={styles.pickerModalTitle}>Filter by Role</Text>
            <TouchableOpacity style={[styles.pickerOption, !filterRoleId && styles.pickerOptionActive]}
              onPress={() => { setFilterRoleId(null); setFilterRolePicker(false); }}>
              <View style={[styles.checkbox, !filterRoleId && styles.checkboxActive]}>{!filterRoleId && <MCIcon name="check" size={14} color="#fff" />}</View>
              <Text style={[styles.pickerOptionText, !filterRoleId && { color: colors.primary, fontWeight: '700' }]}>All Roles</Text>
            </TouchableOpacity>
            <View style={styles.pickerDivider} />
            {(roles || []).filter(r => r.is_active !== false).map(role => (
              <TouchableOpacity key={role.id} style={[styles.pickerOption, filterRoleId === role.id && styles.pickerOptionActive]}
                onPress={() => { setFilterRoleId(role.id); setFilterRolePicker(false); }}>
                <View style={[styles.checkbox, filterRoleId === role.id && styles.checkboxActive]}>{filterRoleId === role.id && <MCIcon name="check" size={14} color="#fff" />}</View>
                <Text style={[styles.pickerOptionText, filterRoleId === role.id && { color: colors.primary, fontWeight: '700' }]}>{role.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },
  tabLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, flexShrink: 1 },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },

  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterPicker: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, flex: 1 },
  filterPickerText: { flex: 1, fontSize: 13, color: colors.textPrimary },
  statusFilter: { flexDirection: 'row', gap: 4 },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  statusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  statusBtnTextActive: { color: '#fff' },

  card: { backgroundColor: colors.card, borderRadius: 12, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardInactive: { backgroundColor: colors.surfaceMuted},
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.headerText },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleChipText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
  cardMeta: { fontSize: 10, color: colors.textMuted, fontWeight: '500' },

  rowBack: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', width: 75, height: '100%' },
  deleteBack: { backgroundColor: '#EF4444' },
  editBack: { backgroundColor: '#3B82F6' },
  backBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  pickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  pickerModalContent: { backgroundColor: colors.card, borderRadius: 14, padding: 16, maxHeight: '70%' },
  pickerModalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  pickerDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  pickerOptionActive: { backgroundColor: colors.primaryFaint },
  pickerOptionText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});

export default ContentManagementScreen;
