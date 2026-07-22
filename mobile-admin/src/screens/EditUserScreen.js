import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
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

const EditUserScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState(null);
  const [editedUser, setEditedUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    role_id: null,
  });
  const [roles, setRoles] = useState([]);

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
        });
        setRoles(rolesRes?.data || []);
      })
      .catch(() => showAlert('Error', 'Failed to load user details'))
      .finally(() => setLoading(false));
  }, [user.id]);

  const handleSave = () => {
    setSaving(true);
    apiClient.put(`${ENDPOINTS.USERS}/${user.id}`, editedUser)
      .then(() => {
        showAlert('Success', 'User updated successfully');
        navigation.goBack();
      })
      .catch(() => showAlert('Error', 'Failed to update user'))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Edit User" onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  const detailFields = [
    { key: 'full_name', value: userData?.full_name },
    { key: 'email', value: userData?.email },
    { key: 'phone', value: userData?.phone || '—' },
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
      <ScreenHeader title="Edit User" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>User Details</Text>
        {detailFields.map(f => (
          <View key={f.key} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{FIELD_LABELS[f.key]}</Text>
            <Text style={styles.detailValue}>{f.value}</Text>
          </View>
        ))}

        <View style={styles.divider} />

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
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20 },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 16, marginBottom: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 },
  detailValue: { fontSize: 14, color: colors.textPrimary, flex: 1.5, textAlign: 'right' },

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
