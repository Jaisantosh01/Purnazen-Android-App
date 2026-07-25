import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ROLE_ICONS } from '../constants/icons';
import { ListSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import SwipeRowActions, { SWIPE_LEFT_OPEN, SWIPE_RIGHT_OPEN } from '../components/SwipeRowActions';
import { showAlert, showConfirm } from '../utils/alert';

const MetadataManagementScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { title, endpoint } = route.params;
  const isRole = title === 'Roles';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ROLE_ICONS[0]);
  const [editingItem, setEditingItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const payload = isRole ? { name: newItemName, icon: selectedIcon } : { name: newItemName };
    const promise = editingItem 
      ? apiClient.put(`${endpoint}/${editingItem.id}`, payload)
      : apiClient.post(endpoint, payload);

    promise
      .then(() => {
        setNewItemName('');
        setSelectedIcon(ROLE_ICONS[0]);
        setEditingItem(null);
        setModalVisible(false);
        fetchItems();
      })
      .catch(() => showAlert('Error', 'Failed to save item'));
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setNewItemName(item.name);
    setSelectedIcon(item.icon || ROLE_ICONS[0]);
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setNewItemName('');
    setSelectedIcon(ROLE_ICONS[0]);
    setModalVisible(true);
  }

  const handleDelete = (id) => {
    showConfirm(
      'Delete entry',
      'This entry will be permanently deleted. Doctors already tagged with it lose the tag.',
      () => {
        apiClient
          .delete(`${endpoint}/${id}`)
          .then(fetchItems)
          .catch(() => showAlert('Error', 'Failed to delete'));
      },
      { confirmLabel: 'Delete', destructive: true },
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
        {isRole && item.icon && <MCIcon name={item.icon} size={20} color={colors.primary} style={{marginRight: 10}} />}
        <Text style={styles.itemName}>{item.name}</Text>
      </View>
      <MCIcon name="drag-horizontal" size={20} color={colors.textMuted} />
    </View>
  );

  // Swipe right reveals Edit (left), swipe left reveals Delete (right) — the
  // same gesture the Users/Doctors lists use (see SwipeRowActions).
  const renderHiddenItem = (data, rowMap) => (
    <SwipeRowActions
      containerStyle={styles.rowBack}
      onClose={() => rowMap[data.item.id]?.closeRow()}
      onEdit={() => startEdit(data.item)}
      onDelete={() => handleDelete(data.item.id)}
    />
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={title}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={openAddModal}>
            <MCIcon name="plus" size={24} color={colors.headerText} />
          </TouchableOpacity>
        }
      />

      {loading && items.length === 0 ? (
        <ListSkeleton count={5} />
      ) : (
        <SwipeListView
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          renderHiddenItem={renderHiddenItem}
          leftOpenValue={SWIPE_LEFT_OPEN}
          rightOpenValue={SWIPE_RIGHT_OPEN}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={fetchItems}
          closeOnRowOpen
          closeOnRowPress
          closeOnRowBeginSwipe
          closeOnScroll
          ListEmptyComponent={!loading && <Text style={styles.emptyText}>No items found</Text>}
        />
      )}

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
                {isRole && (
                    <View style={styles.iconPicker}>
                        <Text style={styles.label}>Select Icon:</Text>
                        <View style={styles.iconContainer}>
                            {ROLE_ICONS.map(icon => (
                                <TouchableOpacity 
                                    key={icon} 
                                    style={[styles.iconOption, selectedIcon === icon && styles.selectedIcon]}
                                    onPress={() => setSelectedIcon(icon)}
                                >
                                    <MCIcon name={icon} size={24} color={selectedIcon === icon ? colors.primary : colors.textPrimary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setModalVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContainer: { padding: 16 },
  itemCard: { backgroundColor: colors.card, padding: 16, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  itemName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  // Only spacing/rounding here — the swipe layer itself lives in SwipeRowActions.
  rowBack: { marginBottom: 8, borderRadius: 12 },
  emptyText: { textAlign: 'center', marginTop: 20, color: colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.modalSurface, borderRadius: 12, padding: 20 , borderWidth: 1, borderColor: colors.modalBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 12},
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: colors.textPrimary },
  modalInput: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 12, height: 44, marginBottom: 15, borderWidth: 1, borderColor: colors.borderStrong, color: colors.textPrimary },
  iconPicker: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.textSecondary },
  iconOption: { padding: 10, borderRadius: 8, marginRight: 8, backgroundColor: colors.surfaceMuted },
  selectedIcon: { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
  modalButtons: { flexDirection: 'row', gap: 10 },
  iconContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.surfaceMuted },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnText: { color: colors.white, fontWeight: 'bold' }
});

export default MetadataManagementScreen;
