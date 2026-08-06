import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { CONTENT_TABS, CONTENT_PLACEHOLDERS, FORMAT_ACTIONS } from '../constants/content';
import { renderRichText, normalizeHtml } from '../utils/richText';
import useTheme from '../hooks/useTheme';
import { showAlert } from '../utils/alert';
import ScreenHeader from '../components/ScreenHeader';
import AppToggle from '../components/AppToggle';

// Inline styles wrap the selected text; line styles wrap whole lines.
const INLINE_ACTIONS = {
  bold: { open: '<b>', close: '</b>' },
  italic: { open: '<i>', close: '</i>' },
};

const LINE_ACTIONS = {
  heading: { open: '<h3>', close: '</h3>' },
  small: { open: '<small>', close: '</small>' },
  bullet: { open: '<li>', close: '</li>' },
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
  const [editorTab, setEditorTab] = useState('write');
  const [saving, setSaving] = useState(false);
  // Set only long enough to drop the caret inside a freshly inserted tag pair.
  // While it is non-null the TextInput's selection is controlled, so it has to
  // be released again or the cursor is pinned and the admin cannot type
  // anywhere else.
  const [selectionOverride, setSelectionOverride] = useState(null);

  const selRef = useRef({ start: 0, end: 0 });
  const selectionTimer = useRef(null);

  useEffect(() => () => clearTimeout(selectionTimer.current), []);

  // Prompts follow the selected content type — a privacy policy asks for
  // different things than terms do.
  const activeTab = CONTENT_TABS.find(t => t.key === contentType);
  const hints = CONTENT_PLACEHOLDERS[contentType] || CONTENT_PLACEHOLDERS.terms;

  useEffect(() => {
    if (editingItem) {
      setContentType(editingItem.type);
      setSelectedRoleIds(editingItem.roleId ? [editingItem.roleId] : []);
      setIsAllSelected(false);
      setTitle(editingItem.title);
      setContent(normalizeHtml(editingItem.content));
      setVersion(editingItem.version || '1.0');
      setIsActive(editingItem.isActive ?? true);
    }
    if (!allRoles) {
      apiClient.get(ENDPOINTS.ROLES)
        .then(res => setRoles(Array.isArray(res?.data) ? res.data : []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const clampSelection = () => {
    const { start, end } = selRef.current;
    const s = Math.max(0, Math.min(start, content.length));
    const e = Math.max(s, Math.min(end, content.length));
    return { start: s, end: e };
  };

  // Wraps the selection in open/close, or unwraps if it is already wrapped.
  const applyInline = ({ open, close }) => {
    const { start, end } = clampSelection();
    if (start === end) {
      // Nothing selected: insert an empty tag pair and put the caret between
      // them so the admin types straight into it.
      const insertion = `${open}${close}`;
      const caret = start + open.length;
      setContent(content.substring(0, start) + insertion + content.substring(end));
      selRef.current = { start: caret, end: caret };
      setSelectionOverride({ start: caret, end: caret });
      // onSelectionChange normally releases the override; the timer covers the
      // case where the caret was already at that offset and nothing fires.
      clearTimeout(selectionTimer.current);
      selectionTimer.current = setTimeout(() => setSelectionOverride(null), 150);
      return;
    }
    const selected = content.substring(start, end);
    if (selected.startsWith(open) && selected.endsWith(close)) {
      setContent(content.substring(0, start) + selected.slice(open.length, selected.length - close.length) + content.substring(end));
    } else if (
      content.substring(Math.max(0, start - open.length), start) === open &&
      content.substring(end, end + close.length) === close
    ) {
      setContent(content.substring(0, start - open.length) + selected + content.substring(end + close.length));
    } else {
      setContent(content.substring(0, start) + open + selected + close + content.substring(end));
    }
  };

  // Toggles a line-level style on every line touched by the selection.
  const applyLine = ({ open, close }) => {
    const { start, end } = clampSelection();
    const lineStart = content.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let lineEnd = content.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = content.length;

    const lines = content.substring(lineStart, lineEnd).split('\n');
    const nonEmpty = lines.filter(l => l.trim());
    const allWrapped = nonEmpty.length > 0 &&
      nonEmpty.every(l => l.trim().startsWith(open) && l.trim().endsWith(close));

    const newLines = lines.map(l => {
      const t = l.trim();
      if (!t) return l;
      const unwrapped = t.startsWith(open) && t.endsWith(close)
        ? t.slice(open.length, t.length - close.length)
        : t;
      return allWrapped ? unwrapped : open + unwrapped + close;
    });

    setContent(content.substring(0, lineStart) + newLines.join('\n') + content.substring(lineEnd));
  };

  const handleFormatPress = (actionKey) => {
    if (INLINE_ACTIONS[actionKey]) applyInline(INLINE_ACTIONS[actionKey]);
    else if (LINE_ACTIONS[actionKey]) applyLine(LINE_ACTIONS[actionKey]);
  };

  const handleSelectionChange = (e) => {
    selRef.current = e.nativeEvent.selection;
    if (selectionOverride) setSelectionOverride(null);
  };

  const canSave = title.trim().length > 0 && content.trim().length > 0 && (isAllSelected || selectedRoleIds.length > 0);

  const handleSave = () => {
    if (!canSave) return;
    setSaving(true);
    const basePayload = {
      type: contentType,
      title: title.trim(),
      content: normalizeHtml(content).trim(),
      version: version || '1.0',
      is_active: isActive,
    };

    if (editingItem) {
      const roleId = isAllSelected ? null : selectedRoleIds[0];
      apiClient.put(`${ENDPOINTS.CONTENT_PAGES}/${editingItem.id}`, { ...basePayload, role_id: roleId || editingItem.roleId })
        .then(() => { navigation.goBack(); })
        .catch(() => { showAlert('Error', 'Failed to save content page'); setSaving(false); });
    } else {
      const targetIds = isAllSelected
        ? roles.filter(r => r.is_active !== false).map(r => r.id)
        : selectedRoleIds;
      if (targetIds.length === 0) { showAlert('Error', 'No roles selected'); setSaving(false); return; }
      Promise.all(targetIds.map(roleId => apiClient.post(ENDPOINTS.CONTENT_PAGES, { ...basePayload, role_ids: [roleId] })))
        .then(() => { navigation.goBack(); })
        .catch(() => { showAlert('Error', 'Failed to save content pages'); setSaving(false); });
    }
  };

  const preview = useMemo(
    () => (editorTab === 'preview' ? renderRichText(content, colors) : null),
    [editorTab, content, colors],
  );

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
            <MCIcon name={activeTab?.icon || 'file-document-outline'} size={18} color={colors.textPrimary} />
            <Text style={styles.pickerText}>{activeTab?.label || contentType}</Text>
            <MCIcon name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.label}>Target Roles <Text style={{ color: '#EF4444' }}>*</Text></Text>
          <TouchableOpacity style={styles.picker} onPress={() => setRolePicker(true)}>
            <MCIcon name={isAllSelected ? 'account-group' : 'account-multiple'} size={18} color={colors.textPrimary} />
            <Text style={styles.pickerText} numberOfLines={1}>{isAllSelected ? 'All Roles' : (selectedRoleIds.length ? selectedRoleIds.map(getRoleName).join(', ') : 'Select roles...')}</Text>
            <MCIcon name="chevron-down" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <Text style={styles.label}>Title <Text style={{ color: '#EF4444' }}>*</Text></Text>
          <TextInput style={styles.input} placeholder={hints.title} placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />

          <View style={styles.versionRow}>
            <View>
              <Text style={styles.label}>Version</Text>
              <TextInput style={[styles.input, { width: 100 }]} placeholder="1.0" placeholderTextColor={colors.textMuted} value={version} onChangeText={setVersion} />
            </View>
            <View style={{ flex: 1 }} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active</Text>
              <AppToggle value={isActive} onValueChange={setIsActive} />
            </View>
          </View>

          <Text style={styles.label}>Content <Text style={{ color: '#EF4444' }}>*</Text></Text>

          <View style={styles.editorTabBar}>
            {['write', 'preview'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.editorTab, editorTab === tab && styles.editorTabActive]}
                onPress={() => setEditorTab(tab)}
              >
                <MCIcon name={tab === 'write' ? 'pencil-outline' : 'eye-outline'} size={15} color={editorTab === tab ? colors.primary : colors.textMuted} />
                <Text style={[styles.editorTabText, editorTab === tab && styles.editorTabTextActive]}>
                  {tab === 'write' ? 'Write' : 'Preview'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {editorTab === 'write' ? (
            <>
              <View style={styles.toolbar}>
                {FORMAT_ACTIONS.map(action => (
                  <TouchableOpacity key={action.key} style={styles.toolbarBtn} onPress={() => handleFormatPress(action.key)}>
                    <MCIcon name={action.icon} size={20} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.editorInput}
                value={content}
                onChangeText={setContent}
                selection={selectionOverride || undefined}
                onSelectionChange={handleSelectionChange}
                placeholder={hints.content}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                cursorColor={colors.primary}
                autoCapitalize="sentences"
                autoCorrect={false}
              />
              <Text style={styles.editorHint}>
                Select text, then tap a style. Use Preview to see the formatted result.
              </Text>
              {/* Only offered on an empty editor — it would otherwise clobber
                  whatever the admin has already written. */}
              {!content.trim() ? (
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setContent(hints.outline)}>
                  <MCIcon name="format-list-numbered" size={16} color={colors.primary} />
                  <Text style={styles.outlineBtnText}>
                    Start from a {activeTab?.label || 'content'} outline
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <View style={styles.previewBox}>
              {content.trim()
                ? preview
                : <Text style={{ color: colors.textMuted, fontSize: 14 }}>Nothing to preview yet.</Text>}
            </View>
          )}

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

  editorTabBar: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  editorTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  editorTabActive: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  editorTabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  editorTabTextActive: { color: colors.primary },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 4, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  toolbarBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  editorInput: { backgroundColor: colors.surfaceMuted, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, lineHeight: 22, color: colors.textPrimary, minHeight: 180, textAlignVertical: 'top' },
  editorHint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  outlineBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  previewBox: { backgroundColor: colors.surfaceMuted, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, minHeight: 180 },

  versionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 40 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.surfaceMuted },
  saveBtn: { backgroundColor: colors.primary },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  pickerModalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', paddingHorizontal: 32 },
  pickerModalContent: { backgroundColor: colors.modalSurface, borderRadius: 14, padding: 16, maxHeight: '70%'  , borderWidth: 1, borderColor: colors.modalBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12},
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
