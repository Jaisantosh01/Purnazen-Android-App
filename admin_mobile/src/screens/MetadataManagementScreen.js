import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { COLORS } from '../constants/theme';

const MetadataManagementScreen = ({ route, navigation }) => {
  const { title, endpoint } = route.params;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [menuVisible, setMenuVisible] = useState(null); // stores ID of item with open menu
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .get(endpoint)
      .then(res => {
        const data = res?.data || (Array.isArray(res) ? res : []);
        setItems(data);
      })
      .catch((err) => {
        console.error(`Error for ${title}:`, err);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  const handleSave = () => {
    if (!newItemName.trim()) return;
    const promise = editingItem 
      ? apiClient.put(`${endpoint}/${editingItem.id}`, { name: newItemName })
      : apiClient.post(endpoint, { name: newItemName });

    promise
      .then(() => {
        setNewItemName('');
        setEditingItem(null);
        setModalVisible(false);
        fetchItems();
      })
      .catch(() => Alert.alert('Error', 'Failed to save item'));
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setNewItemName(item.name);
    setMenuVisible(null);
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setNewItemName('');
    setModalVisible(true);
  }

  const handleDelete = (id) => {
    setMenuVisible(null);
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        onPress: () => {
          apiClient
            .delete(`${endpoint}/${id}`)
            .then(fetchItems)
            .catch(() => Alert.alert('Error', 'Failed to delete'));
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <Text style={styles.itemName}>{item.name}</Text>
      <TouchableOpacity onPress={() => setMenuVisible(menuVisible === item.id ? null : item.id)}>
        <MCIcon name="dots-vertical" size={24} color={COLORS.textMuted} />
      </TouchableOpacity>
      
      {menuVisible === item.id && (
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => startEdit(item)}>
            <MCIcon name="pencil" size={18} color={COLORS.primary} />
            <Text style={styles.menuItemText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => handleDelete(item.id)}>
            <MCIcon name="delete" size={18} color="#FF4D4D" />
            <Text style={[styles.menuItemText, { color: '#FF4D4D' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity onPress={openAddModal}>
          <MCIcon name="plus" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={fetchItems}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>No items found</Text>}
      />

      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{editingItem ? 'Edit ' : 'Add '} {title.slice(0, -1)}</Text>
                <TextInput
                    style={styles.modalInput}
                    placeholder={`Enter ${title.slice(0, -1)} name...`}
                    value={newItemName}
                    onChangeText={setNewItemName}
                />
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  inputContainer: { flexDirection: 'row', padding: 16, gap: 10 },
  input: { flex: 1, backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#ddd' },
  addBtn: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listContainer: { padding: 16 },
  itemCard: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'relative' },
  itemName: { fontSize: 16, fontWeight: '600' },
  menu: { position: 'absolute', right: 40, top: 16, backgroundColor: COLORS.white, borderRadius: 8, padding: 8, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, zIndex: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  menuItemText: { fontSize: 14, fontWeight: '500' },
  emptyText: { textAlign: 'center', marginTop: 20, color: COLORS.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 15, borderWidth: 1, borderColor: '#ddd' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#eee' },
  saveBtn: { backgroundColor: COLORS.primary },
  saveBtnText: { color: COLORS.white, fontWeight: 'bold' }
});

export default MetadataManagementScreen;
