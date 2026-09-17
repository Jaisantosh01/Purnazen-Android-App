/**
 * ManagedListScreen — list + add/edit sheet + show/hide toggle for a simple
 * admin catalog (home quick-relief cards, support contacts, …).
 *
 * Config:
 *   title, subtitle        header text
 *   endpoint               REST collection: GET/POST endpoint, PUT/DELETE endpoint/{id}
 *   fields                 [{ key, label, placeholder?, type: 'text'|'multiline'|'number'|'color'|'choice',
 *                             options?: [{ value, label }], required?, help?, keyboardType?, autoCapitalize? }]
 *   emptyItem              defaults for a new row
 *   isActive(item)         read the row's visible flag
 *   activePayload(bool)    body that switches it on/off
 *   rowTitle(item), rowSubtitle(item), rowIcon(item), rowColor(item)
 *   toForm(item), toPayload(form)
 *   deleteCopy             { title, message } for the hide/delete confirm
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import ScreenHeader from './ScreenHeader';
import AppToggle from './AppToggle';
import useTheme from '../hooks/useTheme';
import { showConfirm } from '../utils/alert';
import { showError, showSuccess } from '../utils/toast';

const HEX = /^#[0-9A-Fa-f]{6}$/;

const unwrap = res => {
  if (res && res.success === false) throw new Error(res.message || 'Request failed');
  return res?.data ?? res;
};

export function validateForm(fields, form) {
  for (const f of fields) {
    const v = form[f.key];
    const empty = v === undefined || v === null || String(v).trim() === '';
    if (f.required && empty) return `${f.label} is required`;
    if (!empty && f.type === 'color' && !HEX.test(String(v).trim())) {
      return `${f.label} must be a colour like #1FA77A`;
    }
    if (!empty && f.type === 'number' && !/^\d+$/.test(String(v).trim())) {
      return `${f.label} must be a whole number`;
    }
  }
  return null;
}

export default function ManagedListScreen({ config }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | { id?, form }
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(
    async (refresh = false) => {
      refresh ? setRefreshing(true) : setLoading(true);
      setError('');
      try {
        const data = unwrap(await apiClient.get(config.endpoint));
        setItems(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message || 'Could not load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [config.endpoint],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openNew = () => {
    setFormError('');
    setEditing({ form: { ...config.emptyItem } });
  };
  const openEdit = item => {
    setFormError('');
    setEditing({ id: item.id, form: config.toForm(item) });
  };
  const setField = (key, value) =>
    setEditing(prev => ({ ...prev, form: { ...prev.form, [key]: value } }));

  const save = async () => {
    const problem = validateForm(config.fields, editing.form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const body = config.toPayload(editing.form);
      if (editing.id) {
        unwrap(await apiClient.put(`${config.endpoint}/${editing.id}`, body));
      } else {
        unwrap(await apiClient.post(config.endpoint, body));
      }
      setEditing(null);
      showSuccess('Saved');
      load();
    } catch (e) {
      setFormError(e.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (item, active) => {
    setBusyId(item.id);
    try {
      unwrap(await apiClient.put(`${config.endpoint}/${item.id}`, config.activePayload(active)));
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, ...config.activePayload(active), isActive: active } : i)));
    } catch (e) {
      showError(e.message || 'Could not update');
    } finally {
      setBusyId(null);
    }
  };

  const remove = item =>
    showConfirm(
      config.deleteCopy.title,
      config.deleteCopy.message(item),
      async () => {
        try {
          unwrap(await apiClient.delete(`${config.endpoint}/${item.id}`));
          load();
        } catch (e) {
          showError(e.message || 'Could not remove');
        }
      },
      { confirmLabel: 'Remove', destructive: true },
    );

  const renderItem = ({ item }) => {
    const active = config.isActive(item);
    return (
      <View style={[styles.row, !active && styles.rowHidden]}>
        <TouchableOpacity style={styles.rowMain} onPress={() => openEdit(item)} activeOpacity={0.8}>
          <View style={[styles.rowIcon, { backgroundColor: config.rowColor?.(item) || colors.primaryLight }]}>
            <MCIcon name={config.rowIcon(item)} size={22} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>{config.rowTitle(item)}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>{config.rowSubtitle(item)}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.rowActions}>
          {busyId === item.id ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <AppToggle value={active} onValueChange={v => setActive(item, v)} />
          )}
          <TouchableOpacity onPress={() => remove(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Remove ${config.rowTitle(item)}`}>
            <MCIcon name="trash-can-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderField = f => {
    const value = editing.form[f.key];
    if (f.type === 'choice') {
      return (
        <View style={styles.choices}>
          {f.options.map(o => {
            const on = value === o.value;
            return (
              <TouchableOpacity key={o.value} style={[styles.choice, on && styles.choiceOn]}
                onPress={() => setField(f.key, o.value)}>
                <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }
    const isColor = f.type === 'color';
    return (
      <View style={styles.inputRow}>
        {isColor ? (
          <View style={[styles.swatch, { backgroundColor: HEX.test(String(value || '')) ? value : 'transparent' }]} />
        ) : null}
        <TextInput
          style={[styles.input, f.type === 'multiline' && styles.inputMulti, isColor && styles.inputFlex]}
          value={value == null ? '' : String(value)}
          onChangeText={t => setField(f.key, t)}
          placeholder={f.placeholder}
          placeholderTextColor={colors.textMuted}
          multiline={f.type === 'multiline'}
          keyboardType={f.type === 'number' ? 'number-pad' : f.keyboardType || 'default'}
          autoCapitalize={isColor ? 'characters' : f.autoCapitalize || 'sentences'}
          autoCorrect={false}
          accessibilityLabel={f.label}
        />
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={config.title}
        subtitle={config.subtitle}
        right={
          <TouchableOpacity onPress={openNew} accessibilityLabel={`Add ${config.itemLabel}`} style={styles.addBtn}>
            <MCIcon name="plus" size={22} color={colors.headerText} />
          </TouchableOpacity>
        }
      />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}
          ListHeaderComponent={config.hint ? <Text style={styles.hint}>{config.hint}</Text> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MCIcon name={error ? 'wifi-alert' : 'playlist-plus'} size={42} color={colors.textMuted} />
              <Text style={styles.emptyText}>{error || `No ${config.itemLabel}s yet. Tap + to add one.`}</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editing?.id ? `Edit ${config.itemLabel}` : `New ${config.itemLabel}`}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
              {editing
                ? config.fields.map(f => (
                    <View key={f.key} style={styles.field}>
                      <Text style={styles.label}>{f.label}{f.required ? ' *' : ''}</Text>
                      {renderField(f)}
                      {f.help ? <Text style={styles.help}>{f.help}</Text> : null}
                    </View>
                  ))
                : null}
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            </ScrollView>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = colors =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    addBtn: { padding: 6 },
    list: { padding: 16, paddingBottom: 40, gap: 10, flexGrow: 1 },
    hint: { fontSize: 12.5, color: colors.textSecondary, marginBottom: 4, lineHeight: 18 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 10,
    },
    rowHidden: { opacity: 0.6 },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    rowSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
    rowActions: { alignItems: 'center', gap: 10 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
    emptyText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
    modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      maxHeight: '88%',
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 18,
      paddingBottom: 28,
    },
    sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: 20, marginBottom: 6 },
    form: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
    field: { gap: 6 },
    label: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary },
    help: { fontSize: 11.5, color: colors.textMuted },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    swatch: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceMuted,
      flexGrow: 1,
    },
    inputFlex: { flex: 1 },
    inputMulti: { minHeight: 90, textAlignVertical: 'top' },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choice: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
    choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    choiceText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    choiceTextOn: { color: colors.white },
    formError: { color: colors.danger, fontSize: 13, fontWeight: '600' },
    sheetActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 10 },
    cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: colors.surfaceMuted },
    cancelText: { fontWeight: '700', color: colors.textSecondary },
    saveBtn: { flex: 2, alignItems: 'center', paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary },
    saveText: { color: colors.white, fontWeight: '800' },
    disabled: { opacity: 0.6 },
  });
