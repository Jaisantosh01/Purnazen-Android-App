import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { COLORS } from '../constants/theme';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ListSkeleton } from '../components/SkeletonLoader';

const FaqManagementScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .get(ENDPOINTS.SUPPORT_FAQS)
      .then(res => {
        const sorted = (Array.isArray(res) ? res : []).sort((a, b) => (a.sort_order ?? 0) - (b.sortOrder ?? 0));
        setItems(sorted);
      })
      .catch((err) => {
        console.error('Error fetching FAQs:', err);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  const handleSave = () => {
    if (!question.trim() || !answer.trim()) return;
    const payload = { question, answer, is_active: isActive };
    const promise = editingItem
      ? apiClient.put(`${ENDPOINTS.SUPPORT_FAQS}/${editingItem.id}`, payload)
      : apiClient.post(ENDPOINTS.SUPPORT_FAQS, payload);

    promise
      .then(() => {
        resetForm();
        setModalVisible(false);
        fetchItems();
      })
      .catch(() => Alert.alert('Error', 'Failed to save FAQ'));
  };

  const resetForm = () => {
    setQuestion('');
    setAnswer('');
    setIsActive(true);
    setEditingItem(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const startEdit = (item) => {
    setEditingItem(item);
    setQuestion(item.question);
    setAnswer(item.answer);
    setIsActive(item.is_active ?? true);
    setModalVisible(true);
  };

  const handleDelete = (id) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          apiClient
            .delete(`${ENDPOINTS.SUPPORT_FAQS}/${id}`)
            .then(fetchItems)
            .catch(() => Alert.alert('Error', 'Failed to delete'));
        },
      },
    ]);
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const onDragEnd = useCallback(({ data }) => {
    setItems(data);
    const updates = data.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));
    Promise.all(
      updates.map(u => apiClient.put(`${ENDPOINTS.SUPPORT_FAQS}/${u.id}`, { sort_order: u.sort_order }))
    ).catch(() => {
      Alert.alert('Error', 'Failed to save order');
      fetchItems();
    });
  }, []);

  const renderItem = useCallback(({ item, drag, isActive: isDragging }) => {
    const isExpanded = expandedIds[item.id];
    const isInactive = item.is_active === false;
    const headerTextColor = isInactive ? COLORS.textMuted : COLORS.white;
    const headerIconColor = isInactive ? COLORS.textMuted : COLORS.white;

    return (
      <ScaleDecorator>
        <View style={[styles.card, isDragging && styles.cardDragging]}>
          <TouchableOpacity
            style={[styles.cardHeader, isInactive && styles.cardHeaderInactive]}
            onPress={() => toggleExpand(item.id)}
            onLongPress={drag}
            delayLongPress={200}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeaderLeft}>
              <MCIcon name="drag" size={20} color={headerIconColor} style={styles.dragHandle} />
              <Text style={[styles.questionText, { color: headerTextColor }]} numberOfLines={isExpanded ? undefined : 1}>{item.question}</Text>
            </View>
            <View style={styles.cardHeaderRight}>
              <MCIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={headerIconColor} />
              <TouchableOpacity onPress={() => startEdit(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MCIcon name="pencil" size={18} color={headerIconColor} style={styles.cardActionIcon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MCIcon name="delete" size={18} color={headerIconColor} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          {isExpanded && (
            <View style={styles.cardBody}>
              <Text style={styles.answerText}>{item.answer}</Text>
            </View>
          )}
        </View>
      </ScaleDecorator>
    );
  }, [expandedIds]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ Management</Text>
        <TouchableOpacity onPress={openAddModal} style={{ padding: 4 }}>
          <MCIcon name="plus" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {loading && items.length === 0 ? (
        <ListSkeleton count={5} />
      ) : (
        <DraggableFlatList
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          onDragEnd={onDragEnd}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={fetchItems}
          ListEmptyComponent={!loading && <Text style={styles.emptyText}>No FAQs found</Text>}
        />
      )}

      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit FAQ' : 'Add FAQ'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Question"
              value={question}
              onChangeText={setQuestion}
              multiline
            />
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Answer"
              value={answer}
              onChangeText={setAnswer}
              multiline
            />
            <View style={styles.modalSwitchRow}>
              <Text style={styles.modalSwitchLabel}>Active</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#ddd', true: COLORS.primary }} />
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingTop: 12, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: COLORS.white,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  listContainer: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12, marginBottom: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardDragging: {
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.headerBg, paddingVertical: 14, paddingHorizontal: 12,
  },
  cardHeaderInactive: {
    backgroundColor: '#E5E7EB',
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  dragHandle: { marginRight: 8 },
  questionText: { fontSize: 15, fontWeight: '700', color: COLORS.white, flex: 1 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardActionIcon: { marginLeft: 4 },
  cardBody: { padding: 12, paddingTop: 8, backgroundColor: COLORS.primaryFaint },
  answerText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, color: COLORS.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 14, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 16 },
  modalInput: {
    backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.textPrimary, marginBottom: 12, borderWidth: 1, borderColor: '#eee', textAlignVertical: 'top',
  },
  modalSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalSwitchLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: COLORS.surfaceMuted },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  saveBtn: { backgroundColor: COLORS.primary },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
});

export default FaqManagementScreen;
