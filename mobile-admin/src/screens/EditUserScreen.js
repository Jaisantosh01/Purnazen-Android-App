import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import DobInput, { isoToParts, validateDobParts } from '../components/DobInput';
import { GENDERS } from '../constants/strings';
import { showAlert } from '../utils/alert';

const FIELD_LABELS = {
  full_name: 'Full Name',
  email: 'Email',
  phone: 'Phone',
  gender: 'Gender',
  date_of_birth: 'Date of Birth',
  age: 'Age',
  role: 'Role',
  auth_provider: 'Auth Provider',
  social_linked: 'Social Linked',
  is_active: 'Status',
  created_at: 'Created At',
  updated_at: 'Updated At',
};

const cleanDigits = raw => raw?.replace(/[^0-9]/g, '') || '';

const formatPhone = raw => {
  const d = cleanDigits(raw);
  if (!d) return '—';
  const num = d.length >= 10 ? d.slice(-10) : d;
  return `+91 ${num.slice(0, 5)} ${num.slice(5)}`;
};

const dialablePhone = raw => {
  const d = cleanDigits(raw);
  if (!d) return '';
  const num = d.length >= 10 ? d.slice(-10) : d;
  return `+91${num}`;
};

const EditUserScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, viewMode: initialViewMode } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [viewMode, setViewMode] = useState(initialViewMode !== false);
  const [editedUser, setEditedUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    role_id: null,
    gender: '',
  });
  const [dob, setDob] = useState({ dd: '', mm: '', yyyy: '' });
  const [roles, setRoles] = useState([]);
  const genders = GENDERS;

  useEffect(() => {
    Promise.all([
      apiClient.get(`${ENDPOINTS.USERS}/${user.id}`),
      apiClient.get(ENDPOINTS.ROLES),
    ])
      .then(([userRes, rolesRes]) => {
        const data = userRes?.data || userRes;
        setUserData(data);
        setEditedUser({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          role_id: data.role_id || null,
          gender: data.gender || '',
        });
        setDob(isoToParts(data.date_of_birth));
        setRoles(rolesRes?.data || []);
      })
      .catch(() => showAlert('Error', 'Failed to load user details'))
      .finally(() => setLoading(false));
  }, [user.id]);

  const handleSave = () => {
    const parsedDob = validateDobParts(dob);
    if (!parsedDob.ok) {
      showAlert('Validation Error', 'Enter a valid date of birth (DD/MM/YYYY).');
      return;
    }
    setSaving(true);
    const age = parsedDob.iso
      ? Math.floor((Date.now() - new Date(parsedDob.iso).getTime()) / 31557600000)
      : undefined;
    apiClient.put(`${ENDPOINTS.USERS}/${user.id}`, {
      ...editedUser,
      date_of_birth: parsedDob.iso || undefined,
      age,
    })
      .then(() => {
        setUserData(prev => ({
          ...prev,
          ...editedUser,
          date_of_birth: parsedDob.iso || prev?.date_of_birth,
        }));
        showAlert('Success', 'User updated successfully');
        setViewMode(true);
      })
      .catch(() => showAlert('Error', 'Failed to update user'))
      .finally(() => setSaving(false));
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    apiClient.get(`${ENDPOINTS.USERS}/${user.id}`)
      .then(res => {
        const data = res?.data || res;
        setUserData(data);
        setEditedUser({
          full_name: data.full_name || '',
          email: data.email || '',
          phone: data.phone || '',
          role_id: data.role_id || null,
          gender: data.gender || '',
        });
        setDob(isoToParts(data.date_of_birth));
      })
      .catch(() => showAlert('Error', 'Failed to refresh user details'))
      .finally(() => setRefreshing(false));
  }, [user.id]);

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="User Details" onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const detailFields = [
    { key: 'full_name', value: userData?.full_name },
    { key: 'email', value: userData?.email },
    { key: 'phone', value: formatPhone(userData?.phone) },
    { key: 'gender', value: userData?.gender || '—' },
    { key: 'date_of_birth', value: userData?.date_of_birth || '—' },
    { key: 'age', value: userData?.age != null ? String(userData.age) : '—' },
    { key: 'role', value: userData?.role || '—' },
    { key: 'auth_provider', value: userData?.auth_provider || 'email' },
    { key: 'social_linked', value: userData?.social_linked ? 'Yes' : 'No' },
    { key: 'is_active', value: userData?.is_active !== false ? 'Active' : 'Inactive' },
    { key: 'created_at', value: userData?.created_at ? new Date(userData.created_at).toLocaleDateString() : '—' },
    { key: 'updated_at', value: userData?.updated_at ? new Date(userData.updated_at).toLocaleDateString() : '—' },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={viewMode ? 'User Details' : 'Edit User'}
        onBack={() => navigation.goBack()}
        right={
          viewMode ? (
            <TouchableOpacity onPress={() => setViewMode(false)} style={styles.headerBtn}>
              <MCIcon name="pencil" size={24} color={colors.headerText} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={viewMode ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} /> : undefined}
      >
        {viewMode ? (
          <>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarCircle}>
                <MCIcon name="account" size={40} color={colors.white} />
              </View>
              <Text style={styles.avatarName}>{userData?.full_name}</Text>
              <Text style={styles.avatarRole}>{userData?.role}</Text>
            </View>

            {detailFields.map(f => {
              const isPhone = f.key === 'phone' && userData?.phone;
              const isEmail = f.key === 'email';
              return (
                <TouchableOpacity
                  key={f.key}
                  style={styles.detailRow}
                  disabled={!isPhone && !isEmail}
                  activeOpacity={0.6}
                  onPress={() => {
                    if (isPhone) {
                      Linking.openURL(`tel:${dialablePhone(userData.phone)}`);
                    } else if (isEmail) {
                      Linking.openURL(`mailto:${userData.email}`);
                    }
                  }}
                >
                  <Text style={styles.detailLabel}>{FIELD_LABELS[f.key]}</Text>
                  <Text style={[styles.detailValue, (isPhone || isEmail) && styles.linkValue]}>
                    {f.value}
                  </Text>
                  {(isPhone || isEmail) && (
                    <MCIcon name="open-in-new" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Edit Fields</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={editedUser.full_name}
              onChangeText={val => setEditedUser({...editedUser, full_name: val})}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={editedUser.email}
              onChangeText={val => setEditedUser({...editedUser, email: val})}
              keyboardType="email-address"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={editedUser.phone}
              onChangeText={val => setEditedUser({...editedUser, phone: val})}
              keyboardType="phone-pad"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Date of Birth</Text>
            <DobInput value={dob} onChange={setDob} />

            <Text style={styles.label}>Gender</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genderScroll}>
              {genders.map(g => {
                const selected = editedUser.gender === g.name;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genderChip, selected && styles.genderChipSelected]}
                    onPress={() => setEditedUser({...editedUser, gender: g.name})}
                  >
                    <Text style={[styles.genderChipText, selected && styles.genderChipTextSelected]}>
                      {g.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Role</Text>
            {roles.map(role => (
              <TouchableOpacity
                key={role.id}
                style={[styles.roleOption, editedUser.role_id === role.id && styles.selectedRole]}
                onPress={() => setEditedUser({...editedUser, role_id: role.id})}
              >
                <Text style={editedUser.role_id === role.id ? styles.selectedRoleText : styles.roleText}>
                  {role.name}
                </Text>
                {editedUser.role_id === role.id && (
                  <MCIcon name="check-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {!viewMode && (
        <View style={styles.footer}>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setViewMode(true)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  headerBtn: { padding: 4 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 16, marginBottom: 12 },

  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  avatarRole: { fontSize: 14, color: colors.textSecondary },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 },
  detailValue: { fontSize: 14, color: colors.textPrimary, flex: 1.5, textAlign: 'right' },
  linkValue: { color: colors.primary, textDecorationLine: 'underline' },

  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 15, marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    fontSize: 14,
  },
  genderScroll: { marginTop: 4 },
  genderChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginRight: 8,
  },
  genderChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderChipText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  genderChipTextSelected: { color: colors.white, fontWeight: '600' },
  roleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.card,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedRole: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  selectedRoleText: { color: colors.primary, fontWeight: '600', fontSize: 14 },

  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: colors.surfaceMuted, marginRight: 10 },
  saveButton: { backgroundColor: colors.primary },
  cancelButtonText: { color: colors.textPrimary, fontWeight: 'bold', fontSize: 14 },
  saveButtonText: { color: colors.white, fontWeight: 'bold', fontSize: 14 },
});

export default EditUserScreen;