import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { showAlert } from '../utils/alert';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ListSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const FaqManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});
  const [sortMode, setSortMode] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .get(ENDPOINTS.SUPPORT_FAQS)
      .then(res => {
        const sorted = (Array.isArray(res) ? res : []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
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
      .catch(() => showAlert('Error', 'Failed to save FAQ'));
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
    showAlert('Delete', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          apiClient
            .delete(`${ENDPOINTS.SUPPORT_FAQS}/${id}`)
            .then(fetchItems)
            .catch(() => showAlert('Error', 'Failed to delete'));
        },
      },
    ]);
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const onDragEnd = useCallback(({ data }) => {
    setItems(data);
    setSortMode(false);
    const updates = data.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));
    Promise.all(
      updates.map(u => apiClient.put(`${ENDPOINTS.SUPPORT_FAQS}/${u.id}`, { sort_order: u.sort_order }))
    ).catch(() => {
      showAlert('Error', 'Failed to save order');
      fetchItems();
    });
  }, []);

  const renderItem = ({ item }) => {
    const isExpanded = expandedIds[item.id];
    const isInactive = item.is_active === false;
    const headerTextColor = isInactive ? colors.textMuted : colors.headerText;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => toggleExpand(item.id)}
        onLongPress={() => setSortMode(true)}
        delayLongPress={400}
      >
        <View style={[styles.card, isInactive && styles.cardInactive]}>
          <View style={[styles.cardHeader, isInactive && styles.cardHeaderInactive]}>
            <View style={styles.cardHeaderLeft}>
              <Text style={[styles.questionText, { color: headerTextColor }]} numberOfLines={isExpanded ? undefined : 1}>{item.question}</Text>
            </View>
            <MCIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={headerTextColor} />
          </View>
          {isExpanded && (
            <View style={styles.cardBody}>
              <Text style={styles.answerText}>{item.answer}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHiddenItem = (data, rowMap) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => { rowMap[data.item.id]?.closeRow(); startEdit(data.item); }}>
        <MCIcon name="pencil" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => { rowMap[data.item.id]?.closeRow(); handleDelete(data.item.id); }}>
        <MCIcon name="delete" size={22} color="#fff" />
        <Text style={styles.backBtnText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const onSwipeValueChange = useCallback((swipeData) => {
    if (swipeData.value !== 0 && expandedIds[swipeData.key]) {
      setExpandedIds(prev => ({ ...prev, [swipeData.key]: false }));
    }
  }, [expandedIds]);

  const renderDraggableItem = useCallback(({ item, drag, isActive: isDragging }) => {
    const isExpanded = expandedIds[item.id];
    const isInactive = item.is_active === false;
    const headerTextColor = isInactive ? colors.textMuted : colors.headerText;

    return (
      <ScaleDecorator>
        <View style={[styles.card, isDragging && styles.cardDragging]}>
          <TouchableOpacity
            style={[styles.cardHeader, isInactive && styles.cardHeaderInactive]}
            onLongPress={drag}
            delayLongPress={100}
            activeOpacity={0.8}
            disabled={!sortMode}
          >
            <View style={styles.cardHeaderLeft}>
              <Text style={[styles.questionText, { color: headerTextColor }]} numberOfLines={isExpanded ? undefined : 1}>{item.question}</Text>
            </View>
            <MCIcon name="drag-horizontal" size={20} color={headerTextColor} />
          </TouchableOpacity>
          {isExpanded && (
            <View style={styles.cardBody}>
              <Text style={styles.answerText}>{item.answer}</Text>
            </View>
          )}
        </View>
      </ScaleDecorator>
    );
  }, [expandedIds, colors, styles, sortMode]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="FAQ Management"
        subtitle="Help & support questions shown to users"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={openAddModal} style={{ padding: 4 }}>
            <MCIcon name="plus" size={24} color={colors.headerText} />
          </TouchableOpacity>
        }
      />

      {sortMode && (
        <View style={styles.sortBannerWrap}>
          <View style={styles.sortBanner}>
            <MCIcon name="sort" size={18} color="#fff" />
            <Text style={styles.sortBannerText}>Drag to reorder</Text>
            <TouchableOpacity style={styles.sortDoneBtn} onPress={() => setSortMode(false)}>
              <Text style={styles.sortDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && items.length === 0 ? (
        <ListSkeleton count={5} />
      ) : sortMode ? (
        <DraggableFlatList
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={renderDraggableItem}
          onDragEnd={onDragEnd}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <SwipeListView
          data={items}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          renderHiddenItem={renderHiddenItem}
          leftOpenValue={75}
          rightOpenValue={-75}
          stopLeftSwipe={130}
          stopRightSwipe={-130}
          onSwipeValueChange={onSwipeValueChange}
          contentContainerStyle={styles.listContainer}
          refreshing={loading}
          onRefresh={fetchItems}
          closeOnRowOpen
          closeOnRowPress
          previewRowKey={null}
          ListEmptyComponent={!loading && <Text style={styles.emptyText}>No FAQs found</Text>}
        />
      )}

      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit FAQ' : 'Add FAQ'}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Question"
              placeholderTextColor={colors.textMuted}
              value={question}
              onChangeText={setQuestion}
              multiline
            />
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Answer"
              placeholderTextColor={colors.textMuted}
              value={answer}
              onChangeText={setAnswer}
              multiline
            />
            <View style={styles.modalSwitchRow}>
              <Text style={styles.modalSwitchLabel}>Active</Text>
              <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: colors.borderStrong, true: colors.primary }} />
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  listContainer: { padding: 12, paddingBottom: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12, marginBottom: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardInactive: { backgroundColor: colors.surfaceMuted },
  cardDragging: {
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.headerBg, paddingVertical: 14, paddingHorizontal: 12,
  },
  cardHeaderInactive: {
    backgroundColor: colors.surfaceMuted,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  questionText: { fontSize: 15, fontWeight: '700', color: colors.headerText, flex: 1 },
  cardBody: { padding: 12, paddingTop: 8, backgroundColor: colors.primaryFaint },
  answerText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, color: colors.textMuted },

  rowBack: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', width: 75, height: '100%' },
  editBack: { backgroundColor: '#3B82F6' },
  deleteBack: { backgroundColor: '#EF4444' },
  backBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  sortBannerWrap: { paddingHorizontal: 12, paddingTop: 8 },
  sortBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderRadius: 8,
  },
  sortBannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#fff' },
  sortDoneBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  sortDoneText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.card, borderRadius: 14, padding: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.textPrimary, marginBottom: 12, borderWidth: 1, borderColor: colors.border, textAlignVertical: 'top',
  },
  modalSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalSwitchLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: colors.surfaceMuted },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
});

export default FaqManagementScreen;
