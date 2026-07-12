import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { CONTENT_TABS, FORMAT_ACTIONS, TAG_MAP } from '../constants/content';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const renderFormatted = (html, colors) => {
  if (!html) return null;
  const raw = [];
  let remaining = html;
  let key = 0;

  while (remaining.length > 0) {
    const tagMatches = ['<b>', '<i>', '<h3>', '<small>', '<li>', '<br>', '<br/>', '<br />', '</b>', '</i>', '</h3>', '</small>', '</li>', '<ul>', '</ul>']
      .map(t => ({ tag: t, idx: remaining.indexOf(t) }))
      .filter(m => m.idx !== -1)
      .sort((a, b) => a.idx - b.idx);

    if (tagMatches.length === 0) {
      raw.push({ type: 'text', el: <Text key={key++} style={{ color: colors.textPrimary }}>{remaining}</Text> });
      break;
    }

    const { tag, idx } = tagMatches[0];
    if (idx > 0) raw.push({ type: 'text', el: <Text key={key++} style={{ color: colors.textPrimary }}>{remaining.substring(0, idx)}</Text> });

    remaining = remaining.substring(idx + tag.length);

    if (tag === '<b>') {
      const e = remaining.indexOf('</b>');
      raw.push({ type: 'text', el: <Text key={key++} style={{ fontWeight: '700', color: colors.textPrimary }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text> });
      if (e !== -1) remaining = remaining.substring(e + 4);
    } else if (tag === '<i>') {
      const e = remaining.indexOf('</i>');
      raw.push({ type: 'text', el: <Text key={key++} style={{ fontStyle: 'italic', color: colors.textPrimary }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text> });
      if (e !== -1) remaining = remaining.substring(e + 4);
    } else if (tag === '<h3>') {
      const e = remaining.indexOf('</h3>');
      raw.push({ type: 'text', el: <Text key={key++} style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, lineHeight: 26 }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text> });
      if (e !== -1) remaining = remaining.substring(e + 5);
    } else if (tag === '<small>') {
      const e = remaining.indexOf('</small>');
      raw.push({ type: 'text', el: <Text key={key++} style={{ fontSize: 11, color: colors.textPrimary }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text> });
      if (e !== -1) remaining = remaining.substring(e + 8);
    } else if (tag === '<br>' || tag === '<br/>' || tag === '<br />') {
      raw.push({ type: 'text', el: <Text key={key++}>{'\n'}</Text> });
    } else if (tag === '<li>') {
      const e = remaining.indexOf('</li>');
      raw.push({ type: 'view', el:
        <View key={key++} style={{ flexDirection: 'row', marginBottom: 4 }}>
          <Text style={{ color: colors.textPrimary, marginRight: 6 }}>{'\u2022'}</Text>
          <Text style={{ color: colors.textPrimary, flex: 1 }}>{e === -1 ? remaining : remaining.substring(0, e)}</Text>
        </View>
      });
      if (e !== -1) remaining = remaining.substring(e + 5);
    }
  }

  if (raw.length === 0) return null;

  const grouped = [];
  let textBuffer = [];

  for (const item of raw) {
    if (item.type === 'text') {
      textBuffer.push(item.el);
    } else {
      if (textBuffer.length > 0) {
        grouped.push(<Text key={`g-${key++}`}>{textBuffer}</Text>);
        textBuffer = [];
      }
      grouped.push(item.el);
    }
  }
  if (textBuffer.length > 0) {
    grouped.push(<Text key={`g-${key++}`}>{textBuffer}</Text>);
  }

  return grouped;
};

const htmlToPlain = (html) => html ? html.replace(/<[^>]*>/g, '') : '';

const mapPos = (html, plainPos) => {
  let p = 0;
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      const close = html.indexOf('>', i);
      if (close !== -1) { i = close; continue; }
    }
    if (p === plainPos) return i;
    p++;
  }
  return html.length;
};

const stripEmptyTags = (html) => {
  let prev;
  let result = html;
  do {
    prev = result;
    result = result.replace(/<(\w+)><\/\1>/g, '');
  } while (result !== prev);
  return result;
};

const ContentEditorScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { editingItem, initialType, roles: allRoles } = route.params || {};

  const [contentType, setContentType] = useState(initialType || 'terms');
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [version, setVersion] = useState('1.0');
  const [isActive, setIsActive] = useState(true);
  const [roles, setRoles] = useState(allRoles || []);
  const [contentTypePicker, setContentTypePicker] = useState(false);
  const [rolePicker, setRolePicker] = useState(false);
  const [activeFormats, setActiveFormats] = useState({});
  const [saving, setSaving] = useState(false);

  const contentRef = useRef(null);
  const selRef = useRef({ start: 0, end: 0 });
  const displayContent = useMemo(() => htmlToPlain(content), [content]);

  useEffect(() => {
    if (editingItem) {
      setContentType(editingItem.type);
      setSelectedRoleIds(editingItem.roleId ? [editingItem.roleId] : []);
      setIsAllSelected(false);
      setTitle(editingItem.title);
      setContent(editingItem.content);
      setVersion(editingItem.version || '1.0');
      setIsActive(editingItem.isActive ?? true);
    }
    if (!allRoles) {
      apiClient.get(ENDPOINTS.ROLES)
        .then(res => setRoles(Array.isArray(res?.data) ? res.data : []))
        .catch(() => {});
    }
  }, []);

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
    const { start, end } = selRef.current;
    const htmlStart = mapPos(content, start);
    const htmlEnd = mapPos(content, end);

    if (actionKey === 'bullet') {
      const selected = content.substring(htmlStart, htmlEnd);
      const tagOpen = '<li>', tagClose = '</li>';
      const insertion = tagOpen + (selected || 'item') + tagClose;
      setContent(content.substring(0, htmlStart) + insertion + content.substring(htmlEnd));
      return;
    }

    setActiveFormats(prev => {
      const next = { ...prev };
      if (next[actionKey]) delete next[actionKey];
      else next[actionKey] = true;
      return next;
    });

    if (start !== end) {
      const { open, close } = TAG_MAP[actionKey] || {};
      if (open && close) {
        const selected = content.substring(htmlStart, htmlEnd);
        setContent(content.substring(0, htmlStart) + open + selected + close + content.substring(htmlEnd));
      }
    }
  };

  const handleChangeText = (newPlain) => {
    const oldPlain = htmlToPlain(content);
    if (oldPlain === newPlain) return;

    let diffStart = 0;
    while (diffStart < oldPlain.length && diffStart < newPlain.length && oldPlain[diffStart] === newPlain[diffStart]) {
      diffStart++;
    }

    let diffEndOld = oldPlain.length;
    let diffEndNew = newPlain.length;
    while (diffEndOld > diffStart && diffEndNew > diffStart && oldPlain[diffEndOld - 1] === newPlain[diffEndNew - 1]) {
      diffEndOld--;
      diffEndNew--;
    }

    const htmlStart = mapPos(content, diffStart);
    const removedLen = diffEndOld - diffStart;
    const htmlEnd = mapPos(content, diffStart + removedLen);
    const inserted = newPlain.substring(diffStart, diffEndNew);

    const activeKeys = Object.keys(activeFormats);
    let wrapped = inserted;
    activeKeys.forEach(k => {
      const t = TAG_MAP[k];
      if (t && k !== 'bullet') wrapped = t.open + wrapped + t.close;
    });

    const result = content.substring(0, htmlStart) + wrapped + content.substring(htmlEnd);
    setContent(stripEmptyTags(result));
  };

  const canSave = title.trim().length > 0 && content.trim().length > 0 && (isAllSelected || selectedRoleIds.length > 0);

  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);
    const basePayload = { type: contentType, title: title.trim(), content: content.trim(), version: version || '1.0', is_active: isActive };

    if (editingItem) {
      const roleId = isAllSelected ? null : selectedRoleIds[0];
      apiClient.put(`${ENDPOINTS.CONTENT_PAGES}/${editingItem.id}`, { ...basePayload, role_id: roleId || editingItem.roleId })
        .then(() => { navigation.goBack(); })
        .catch(() => { Alert.alert('Error', 'Failed to save content page'); setSaving(false); });
    } else {
      const targetIds = isAllSelected
        ? roles.filter(r => r.is_active !== false).map(r => r.id)
        : selectedRoleIds;
      if (targetIds.length === 0) { Alert.alert('Error', 'No roles selected'); setSaving(false); return; }
      Promise.all(targetIds.map(roleId => apiClient.post(ENDPOINTS.CONTENT_PAGES, { ...basePayload, role_ids: [roleId] })))
        .then(() => { navigation.goBack(); })
        .catch(() => { Alert.alert('Error', 'Failed to save content pages'); setSaving(false); });
    }
  };

  const formattedContent = useMemo(() => renderFormatted(content, colors), [content, colors]);
  const formatIndicator = Object.keys(activeFormats).length > 0;

  const handleSelectionChange = (e) => {
    const s = e.nativeEvent.selection;
    selRef.current = s;
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title={editingItem ? 'Edit Content' : 'Create Content'}
          onBack={() => navigation.goBack()}
        />

        <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
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
              value={displayContent}
              onChangeText={handleChangeText}
              onSelectionChange={handleSelectionChange}
              multiline
              textAlignVertical="top"
              cursorColor={colors.primary}
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.borderStrong, true: '#22C55E' }} thumbColor={isActive ? '#22C55E' : '#f4f3f4'} />
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.saveBtn, (!canSave || saving) && { opacity: 0.5 }]}
              disabled={!canSave || saving}
              onPress={handleSave}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : (editingItem ? 'Update' : 'Save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

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
  modalContent: { flex: 1, padding: 20, marginBottom: 16 },
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

export default ContentEditorScreen;
