import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Switch,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { CONTENT_TABS, FORMAT_ACTIONS, TAG_MAP } from '../constants/content';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const renderFormatted = (html, colors) => {
  if (!html) return null;
  const elements = [];
  let remaining = html;
  let key = 0;

  while (remaining.length > 0) {
    const tagMatches = ['<b>', '<i>', '<h3>', '<small>', '<li>', '<br>', '<br/>', '<br />', '</b>', '</i>', '</h3>', '</small>', '</li>', '<ul>', '</ul>']
      .map(t => ({ tag: t, idx: remaining.indexOf(t) }))
      .filter(m => m.idx !== -1)
      .sort((a, b) => a.idx - b.idx);

    if (tagMatches.length === 0) {
      elements.push(<Text key={key++} style={{ color: colors.textPrimary }}>{remaining}</Text>);
      break;
    }

    const { tag, idx } = tagMatches[0];
    if (idx > 0) elements.push(<Text key={key++} style={{ color: colors.textPrimary }}>{remaining.substring(0, idx)}</Text>);

    remaining = remaining.substring(idx + tag.length);

    if (tag === '<b>') {
      const e = remaining.indexOf('</b>');
      elements.push(<Text key={key++} style={{ fontWeight: '700', color: colors.textPrimary }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text>);
      if (e !== -1) remaining = remaining.substring(e + 4);
    } else if (tag === '<i>') {
      const e = remaining.indexOf('</i>');
      elements.push(<Text key={key++} style={{ fontStyle: 'italic', color: colors.textPrimary }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text>);
      if (e !== -1) remaining = remaining.substring(e + 4);
    } else if (tag === '<h3>') {
      const e = remaining.indexOf('</h3>');
      elements.push(<Text key={key++} style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, lineHeight: 26 }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text>);
      if (e !== -1) remaining = remaining.substring(e + 5);
    } else if (tag === '<small>') {
      const e = remaining.indexOf('</small>');
      elements.push(<Text key={key++} style={{ fontSize: 11, color: colors.textPrimary }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text>);
      if (e !== -1) remaining = remaining.substring(e + 8);
    } else if (tag === '<br>' || tag === '<br/>' || tag === '<br />') {
      elements.push(<Text key={key++}>{'\n'}</Text>);
    } else if (tag === '<li>') {
      const e = remaining.indexOf('</li>');
      elements.push(
        <View key={key++} style={{ flexDirection: 'row' }}>
          <Text style={{ color: colors.textPrimary, marginRight: 6 }}>{'\u2022'}</Text>
          <Text style={{ color: colors.textPrimary, flex: 1 }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text>
        </View>
      );
      if (e !== -1) remaining = remaining.substring(e + 5);
    }
  }

  return elements;
};

const ContentManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [pages, setPages] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('terms');

  const [contentType, setContentType] = useState('terms');
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('1.0');
  const [isActive, setIsActive] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [filterRoleId, setFilterRoleId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [contentTypePicker, setContentTypePicker] = useState(false);
  const [rolePicker, setRolePicker] = useState(false);
  const [filterRolePicker, setFilterRolePicker] = useState(false);
  const [activeFormats, setActiveFormats] = useState({});
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  const contentRef = useRef(null);
  const selRef = useRef({ start: 0, end: 0 });

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

  const toggleRole = (roleId) => {
    if (roleId === 'all') { setIsAllSelected(!isAllSelected); setSelectedRoleIds([]); return; }
    if (isAllSelected) return;
    setSelectedRoleIds(prev => prev.includes(roleId) ? prev.filter(r => r !== roleId) : [...prev, roleId]);
  };

  const handleFormatPress = (actionKey) => {
    if (actionKey === 'bullet') {
      const { start, end } = selRef.current;
      const selected = content.substring(start, end);
      const tagOpen = '<li>', tagClose = '</li>';
      const insertion = tagOpen + (selected || 'item') + tagClose;
      setContent(content.substring(0, start) + insertion + content.substring(end));
      return;
    }

    setActiveFormats(prev => {
      const next = { ...prev };
      if (next[actionKey]) delete next[actionKey];
      else next[actionKey] = true;
      return next;
    });

    const { start, end } = selRef.current;
    if (start !== end) {
      const { open, close } = TAG_MAP[actionKey] || {};
      if (open && close) {
        const selected = content.substring(start, end);
        setContent(content.substring(0, start) + open + selected + close + content.substring(end));
      }
    }
  };

  const handleChangeText = (newText) => {
    const activeKeys = Object.keys(activeFormats);
    if (activeKeys.length === 0) { setContent(newText); return; }

    const addedLen = newText.length - content.length;
    if (addedLen <= 0) { setContent(newText); return; }

    let inserted = '';
    let insPos = 0;
    for (let i = 0; i < newText.length; i++) {
      if (i >= content.length || newText[i] !== content[i]) {
        insPos = i;
        inserted = newText.substring(i);
        break;
      }
    }

    if (!inserted) { setContent(newText); return; }

    let wrapped = inserted;
    activeKeys.forEach(k => {
      const t = TAG_MAP[k];
      if (t && k !== 'bullet') wrapped = t.open + wrapped + t.close;
    });

    setContent(newText.substring(0, insPos) + wrapped);
  };

  const canSave = title.trim().length > 0 && content.trim().length > 0 && (isAllSelected || selectedRoleIds.length > 0);

  const handleSave = () => {
    if (!canSave) return;
    const basePayload = { type: contentType, title: title.trim(), content: content.trim(), version: version || '1.0', is_active: isActive };

    if (editingItem) {
      const roleId = isAllSelected ? null : selectedRoleIds[0];
      apiClient.put(`${ENDPOINTS.CONTENT_PAGES}/${editingItem.id}`, { ...basePayload, role_id: roleId || editingItem.roleId })
        .then(() => { resetForm(); setModalVisible(false); fetchPages(); })
        .catch(() => Alert.alert('Error', 'Failed to save content page'));
    } else {
      const targetIds = isAllSelected
        ? roles.filter(r => r.is_active !== false).map(r => r.id)
        : selectedRoleIds;
      if (targetIds.length === 0) { Alert.alert('Error', 'No roles selected'); return; }
      Promise.all(targetIds.map(roleId => apiClient.post(ENDPOINTS.CONTENT_PAGES, { ...basePayload, role_ids: [roleId] })))
        .then(() => { resetForm(); setModalVisible(false); fetchPages(); })
        .catch(() => Alert.alert('Error', 'Failed to save content pages'));
    }
  };

  const resetForm = () => {
    setContentType('terms'); setSelectedRoleIds([]); setIsAllSelected(false); setTitle(''); setContent(''); setVersion('1.0');
    setIsActive(true); setEditingItem(null); setContentTypePicker(false); setRolePicker(false); setActiveFormats({});
  };

  const openAddModal = () => { resetForm(); setContentType(activeTab); setModalVisible(true); };

  const startEdit = (item, rowMap) => {
    if (rowMap?.[item.id]) rowMap[item.id].closeRow();
    setEditingItem(item); setContentType(item.type);
    setSelectedRoleIds(item.roleId ? [item.roleId] : []);
    setIsAllSelected(false);
    setTitle(item.title); setContent(item.content); setVersion(item.version || '1.0');
    setIsActive(item.isActive ?? true); setActiveFormats({}); setModalVisible(true);
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
      <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => handleDelete(data.item.id, rowMap)}>
        <MCIcon name="delete" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Delete</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => startEdit(data.item, rowMap)}>
        <MCIcon name="pencil" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  const formattedContent = useMemo(() => renderFormatted(content, colors), [content, colors]);

  const formatIndicator = Object.keys(activeFormats).length > 0;

  const handleSelectionChange = (e) => {
    const s = e.nativeEvent.selection;
    selRef.current = s;
    setSelection(s);
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title="Content Management"
          subtitle="Terms, conditions & privacy policies"
          onBack={() => navigation.goBack()}
          right={
            <TouchableOpacity onPress={openAddModal} style={{ padding: 4 }}>
              <MCIcon name="plus" size={24} color={colors.primary} />
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

        <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <KeyboardAvoidingView style={styles.editModalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Content' : 'Create Content'}</Text>

              <Text style={styles.label}>Content Type <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TouchableOpacity style={styles.picker} onPress={() => setContentTypePicker(true)}>
                <MCIcon name={contentType === 'terms' ? 'file-document-outline' : 'shield-lock-outline'} size={18} color={colors.textPrimary} />
                <Text style={styles.pickerText}>{CONTENT_TABS.find(t => t.key === contentType)?.label || contentType}</Text>
                <MCIcon name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>Target Roles <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TouchableOpacity style={styles.picker} onPress={() => setRolePicker(true)}>
                <MCIcon name={isAllSelected ? 'account-group' : 'account-multiple'} size={18} color={colors.textPrimary} />
                <Text style={styles.pickerText} numberOfLines={1}>{isAllSelected ? 'All Roles' : (selectedRoleIds.length ? selectedRoleIds.map(getRoleName).join(', ') : 'Select roles...')}</Text>
                <MCIcon name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.label}>Title <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <TextInput style={styles.input} placeholder="e.g. Terms & Conditions v2" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />

              <Text style={styles.label}>Version</Text>
              <TextInput style={[styles.input, { width: 120 }]} placeholder="1.0" placeholderTextColor={colors.textMuted} value={version} onChangeText={setVersion} />

              <Text style={styles.label}>Content <Text style={{ color: '#EF4444' }}>*</Text></Text>
              <View style={styles.toolbar}>
                {FORMAT_ACTIONS.map(action => {
                  const isOn = activeFormats[action.key];
                  return (
                    <TouchableOpacity key={action.key} style={[styles.toolbarBtn, isOn && styles.toolbarBtnOn]} onPress={() => handleFormatPress(action.key)}>
                      <MCIcon name={action.icon} size={20} color={isOn ? '#fff' : colors.primary} />
                    </TouchableOpacity>
                  );
                })}
                {formatIndicator && (
                  <View style={{ flexDirection: 'row', marginLeft: 4, gap: 2 }}>
                    {Object.keys(activeFormats).map(k => (
                      <View key={k} style={styles.formatPill}>
                        <Text style={styles.formatPillText}>{k === 'bold' ? 'B' : k === 'italic' ? 'I' : k === 'heading' ? 'H' : k === 'small' ? 'S' : ''}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.editorContainer}>
                <View style={styles.editorBackdrop} pointerEvents="none">
                  {formattedContent || (
                    <Text style={[styles.editorText, { color: colors.textMuted }]}>Write content here...</Text>
                  )}
                </View>
                <TextInput
                  ref={contentRef}
                  style={styles.editorInput}
                  value={content}
                  onChangeText={handleChangeText}
                  onSelectionChange={handleSelectionChange}
                  multiline
                  textAlignVertical="top"
                  cursorColor={colors.primary}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Active</Text>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.borderStrong, true: colors.primary }} />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => { setModalVisible(false); resetForm(); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.saveBtn, !canSave && { opacity: 0.5 }]} disabled={!canSave} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>{editingItem ? 'Update' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={contentTypePicker} transparent={true} animationType="fade" onRequestClose={() => setContentTypePicker(false)}>
          <TouchableOpacity style={styles.pickerModalOverlay} activeOpacity={1} onPress={() => setContentTypePicker(false)}>
            <View style={styles.pickerModalContent}>
              {CONTENT_TABS.map(tab => (
                <TouchableOpacity key={tab.key} style={[styles.pickerOption, contentType === tab.key && styles.pickerOptionActive]}
                  onPress={() => { setContentType(tab.key); setContentTypePicker(false); }}>
                  <MCIcon name={tab.icon} size={20} color={contentType === tab.key ? colors.primary : colors.textPrimary} />
                  <Text style={[styles.pickerOptionText, contentType === tab.key && { color: colors.primary, fontWeight: '700' }]}>{tab.label}</Text>
                  {contentType === tab.key && <MCIcon name="check" size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

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

        <Modal visible={rolePicker} transparent={true} animationType="fade" onRequestClose={() => setRolePicker(false)}>
          <TouchableOpacity style={styles.pickerModalOverlay} activeOpacity={1} onPress={() => setRolePicker(false)}>
            <View style={styles.pickerModalContent}>
              <Text style={styles.pickerModalTitle}>Select Target Roles</Text>
              {!editingItem && (
                <>
                  <TouchableOpacity style={[styles.pickerOption, isAllSelected && styles.pickerOptionActive]} onPress={() => toggleRole('all')}>
                    <View style={[styles.checkbox, isAllSelected && styles.checkboxActive]}>{isAllSelected && <MCIcon name="check" size={14} color="#fff" />}</View>
                    <MCIcon name="account-group" size={20} color={isAllSelected ? colors.primary : colors.textPrimary} />
                    <Text style={[styles.pickerOptionText, isAllSelected && { color: colors.primary, fontWeight: '700' }]}>All Roles</Text>
                  </TouchableOpacity>
                  <View style={styles.pickerDivider} />
                </>
              )}
              {(roles || []).filter(r => r.is_active !== false).map(role => {
                const isRoleSelected = selectedRoleIds.includes(role.id);
                const disabled = isAllSelected;
                return (
                  <TouchableOpacity key={role.id}
                    style={[styles.pickerOption, isRoleSelected && styles.pickerOptionActive, disabled && styles.pickerOptionDisabled]}
                    onPress={() => !disabled && toggleRole(role.id)} activeOpacity={disabled ? 1 : 0.7}>
                    <View style={[styles.checkbox, isRoleSelected && styles.checkboxActive]}>{isRoleSelected && <MCIcon name="check" size={14} color="#fff" />}</View>
                    <MCIcon name="account" size={20} color={disabled ? colors.textMuted : (isRoleSelected ? colors.primary : colors.textPrimary)} />
                    <Text style={[styles.pickerOptionText, isRoleSelected && { color: colors.primary, fontWeight: '700' }, disabled && { color: colors.textMuted }]}>{role.name}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[styles.doneBtn, { opacity: isAllSelected || selectedRoleIds.length > 0 ? 1 : 0.5 }]}
                disabled={!isAllSelected && selectedRoleIds.length === 0} onPress={() => setRolePicker(false)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
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

  editModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalContent: { backgroundColor: colors.card, borderRadius: 14, padding: 20, maxHeight: '90%', alignSelf: 'center', width: '100%', maxWidth: 600 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  pickerText: { flex: 1, fontSize: 14, color: colors.textPrimary },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 4, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  toolbarBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toolbarBtnOn: { backgroundColor: colors.primary, borderRadius: 8 },
  formatPill: { backgroundColor: colors.primaryLight, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 2 },
  formatPillText: { fontSize: 10, fontWeight: '700', color: colors.primary },

  editorContainer: { position: 'relative', minHeight: 180, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  editorBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingVertical: 10 },
  editorText: { fontSize: 14, lineHeight: 22 },
  editorInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 22, color: 'transparent', minHeight: 180, textAlignVertical: 'top' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.surfaceMuted },
  saveBtn: { backgroundColor: colors.primary },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  pickerModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 32 },
  pickerModalContent: { backgroundColor: colors.card, borderRadius: 14, padding: 16, maxHeight: '70%' },
  pickerModalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12, textAlign: 'center' },
  pickerDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  pickerOptionActive: { backgroundColor: colors.primaryFaint },
  pickerOptionDisabled: { opacity: 0.5 },
  pickerOptionText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  doneBtn: { backgroundColor: colors.primary, marginTop: 12, padding: 14, borderRadius: 10, alignItems: 'center' },
  doneBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default ContentManagementScreen;
