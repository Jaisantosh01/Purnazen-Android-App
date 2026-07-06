import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import { showAlert } from '../utils/alert';

const EditUserScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = route.params;
  const [loading, setLoading] = useState(false);
  const [editedUser, setEditedUser] = useState({ 
    full_name: user.full_name, 
    email: user.email,
    role_id: user.role_id 
  });
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    apiClient.get(ENDPOINTS.ROLES).then(res => setRoles(res.data || []));
  }, []);

  const handleSave = () => {
    setLoading(true);
    apiClient.put(`${ENDPOINTS.USERS}/${user.id}`, editedUser)
      .then(() => {
        showAlert('Success', 'User updated successfully');
        navigation.goBack();
      })
      .catch((error) => {
        showAlert('Error', 'Failed to update user');
        console.error(error);
      })
      .finally(() => setLoading(false));
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit User</Text>
        <View style={{width: 24}} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={editedUser.full_name} onChangeText={(val) => setEditedUser({...editedUser, full_name: val})} />
        
        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={editedUser.email} onChangeText={(val) => setEditedUser({...editedUser, email: val})} keyboardType="email-address" />
        
        <Text style={styles.label}>Role</Text>
        {roles.map(role => (
          <TouchableOpacity 
            key={role.id} 
            style={[styles.roleOption, editedUser.role_id === role.id && styles.selectedRole]}
            onPress={() => setEditedUser({...editedUser, role_id: role.id})}
          >
            <Text style={editedUser.role_id === role.id ? styles.selectedRoleText : styles.roleText}>{role.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 56, padding: 20, backgroundColor: colors.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  content: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 15 },
  input: { backgroundColor: colors.card, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, marginTop: 8 },
  roleOption: { padding: 15, backgroundColor: colors.card, marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  selectedRole: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleText: { color: colors.textPrimary },
  selectedRoleText: { color: colors.primary, fontWeight: '600' },
  footer: { flexDirection: 'row', padding: 20, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: colors.surfaceMuted, marginRight: 10 },
  saveButton: { backgroundColor: colors.primary },
  cancelButtonText: { color: colors.textPrimary, fontWeight: 'bold' },
  saveButtonText: { color: colors.white, fontWeight: 'bold' }
});

export default EditUserScreen;
