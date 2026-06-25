import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';

const EditUserScreen = ({ route, navigation }) => {
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
        Alert.alert('Success', 'User updated successfully');
        navigation.goBack();
      })
      .catch((error) => {
        Alert.alert('Error', 'Failed to update user');
        console.error(error);
      })
      .finally(() => setLoading(false));
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, padding: 20, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  content: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginTop: 15 },
  input: { backgroundColor: COLORS.white, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginTop: 8 },
  roleOption: { padding: 15, backgroundColor: COLORS.white, marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  selectedRole: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  roleText: { color: COLORS.textPrimary },
  selectedRoleText: { color: COLORS.primary, fontWeight: '600' },
  footer: { flexDirection: 'row', padding: 20, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#eee' },
  button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#eee', marginRight: 10 },
  saveButton: { backgroundColor: COLORS.primary },
  cancelButtonText: { color: COLORS.textPrimary, fontWeight: 'bold' },
  saveButtonText: { color: COLORS.white, fontWeight: 'bold' }
});

export default EditUserScreen;
