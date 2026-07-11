import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ListSkeleton } from '../components/SkeletonLoader';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert } from '../utils/alert';

const ITEM_HEIGHT = 40;
const SLOT_CARD_HEIGHT = 58;

const TimePickerColumn = ({ data, value, onChange }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const flatListRef = React.useRef(null);
  const index = data.findIndex(item => item === value);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: index * ITEM_HEIGHT, animated: false });
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMomentumScrollEnd = (event) => {
    const y = event.nativeEvent.contentOffset.y;
    const selectedIndex = Math.round(y / ITEM_HEIGHT);
    onChange(data[selectedIndex]);
  };

  return (
    <View style={styles.pickerContainer}>
      <View style={styles.selectionIndicator} />
      <FlatList
        ref={flatListRef}
        data={data}
        keyExtractor={(item) => item}
        renderItem={({ item }) => <View style={styles.pickerItem}><Text style={styles.pickerItemText}>{item}</Text></View>}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: 30 + ITEM_HEIGHT * index, index })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingTop: 30, paddingBottom: 30 }}
      />
    </View>
  );
};

const TimeSelector = ({ value, onChange }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [h, m] = value.split(':');
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <View style={styles.timeSelector}>
      <TimePickerColumn data={hours} value={h} onChange={(hVal) => onChange(`${hVal}:${m}:00`)} />
      <Text style={styles.timeSep}>:</Text>
      <TimePickerColumn data={minutes} value={m} onChange={(mVal) => onChange(`${h}:${mVal}:00`)} />
    </View>
  );
};

const SlotManagementScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [targetDay, setTargetDay] = useState(null);
  const [start, setStart] = useState('09:00:00');
  const [end, setEnd] = useState('10:00:00');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchSlots);
    return unsubscribe;
  }, [navigation]);

  const fetchSlots = () => {
    setLoading(true);
    apiClient.get(ENDPOINTS.SLOT_TIMINGS)
      .then(res => {
        const data = res.data || [];
        setDays(data);
        if (data.length > 0) setSelectedDay(prev => data.find(d => d.day === prev?.day) || data[0]);
      })
      .finally(() => setLoading(false));
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);

  const handleSaveSlot = () => {
    if (!targetDay) { showAlert('Error', 'Please select a day'); return; }

    const payload = {
        day_of_week_id: targetDay.id,
        start_time: start.length === 5 ? `${start}:00` : start,
        end_time: end.length === 5 ? `${end}:00` : end
    };

    if (isEditing && editingSlot) {
        apiClient.put(`${ENDPOINTS.SLOT_TIMINGS}/${editingSlot.id}`, payload)
        .then(() => { setModalVisible(false); setIsEditing(false); setEditingSlot(null); fetchSlots(); })
        .catch(err => showAlert('Error', 'Failed to update slot'));
    } else {
        apiClient.post(ENDPOINTS.SLOT_TIMINGS, payload)
        .then(() => { setModalVisible(false); fetchSlots(); })
        .catch(err => showAlert('Error', 'Failed to add slot'));
    }
  };

  const handleDeleteSlot = (slotId) => {
    showAlert('Delete Slot', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
            apiClient.delete(`${ENDPOINTS.SLOT_TIMINGS}/${slotId}`)
            .then(fetchSlots)
            .catch(err => showAlert('Error', 'Failed to delete slot'));
        }}
    ]);
  };

  const openEditModal = (slot) => {
    setEditingSlot(slot);
    setTargetDay(selectedDay);
    setStart(slot.start_time);
    setEnd(slot.end_time);
    setIsEditing(true);
    setModalVisible(true);
  };

  const renderDayItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.dayItem, selectedDay?.day === item.day && styles.selectedDayItem]}
      onPress={() => setSelectedDay(item)}
    >
      <Text style={[styles.dayText, selectedDay?.day === item.day && styles.selectedDayText]}>{item.day.slice(0, 3)}</Text>
      {selectedDay?.day === item.day && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );

  const renderHiddenItem = (data, rowMap) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => { handleDeleteSlot(data.item.id); rowMap[data.item.id]?.closeRow(); }}><MCIcon name="delete" size={24} color={colors.white} /></TouchableOpacity>
      <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => { openEditModal(data.item); rowMap[data.item.id]?.closeRow(); }}><MCIcon name="pencil" size={24} color={colors.white} /></TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Schedule Manager"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity style={styles.addBtn} onPress={() => { setIsEditing(false); setEditingSlot(null); setTargetDay(selectedDay); setModalVisible(true); }}>
            <MCIcon name="plus" size={24} color={colors.headerText} />
          </TouchableOpacity>
        }
      />
      
      {loading ? (
        <View style={styles.content}>
          <View style={styles.sidebar}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <View key={d} style={[styles.dayBtn, { borderWidth: 0, height: 40, marginBottom: 4 }]}>
                <View style={{ width: 24, height: 14, borderRadius: 4, backgroundColor: colors.surfaceMuted }} />
              </View>
            ))}
          </View>
          <View style={styles.mainContent}>
            <View style={{ height: 24, width: 120, borderRadius: 6, backgroundColor: colors.surfaceMuted, marginBottom: 16 }} />
            <ListSkeleton count={5} />
          </View>
        </View>
      ) :
      <View style={styles.content}>
        <View style={styles.sidebar}>
          <FlatList data={days} renderItem={renderDayItem} keyExtractor={item => item.day} showsVerticalScrollIndicator={false} />
        </View>
        <View style={styles.mainContent}>
          <Text style={styles.selectedDayTitle}>{selectedDay?.day || 'Select Day'}</Text>
          <SwipeListView
            data={selectedDay?.slots || []}
            keyExtractor={slot => slot.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.slotCard, !item.is_active && styles.inactiveCard]}
                activeOpacity={0.85}
                onPress={() => openEditModal(item)}
              >
                <View style={styles.slotTimeWrap}>
                  <MCIcon name="clock-outline" size={18} color={colors.primary} />
                  <Text style={styles.timeText}>{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</Text>
                </View>
                <MCIcon name="drag-horizontal" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            renderHiddenItem={renderHiddenItem}
            leftOpenValue={75}
            rightOpenValue={-75}
          />
        </View>
      </View>}
      
      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{isEditing ? 'Edit Slot' : 'Add New Slot'}</Text>
                
                <Text style={styles.label}>Select Day</Text>
                <ScrollView horizontal style={styles.daySelector} showsHorizontalScrollIndicator={false}>
                    {days.map(d => (
                        <TouchableOpacity key={d.day} style={[styles.dayChip, targetDay?.day === d.day && styles.selectedChip]} onPress={() => setTargetDay(d)}>
                            <Text style={[styles.chipText, targetDay?.day === d.day && styles.selectedChipText]}>{d.day.slice(0, 3)}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.label}>Start Time (24h)</Text>
                <TimeSelector value={start} onChange={setStart} />
                <Text style={[styles.label, {marginTop: 8}]}>End Time (24h)</Text>
                <TimeSelector value={end} onChange={setEnd} />
                
                <View style={styles.modalActions}>
                    <TouchableOpacity style={styles.modalBtn} onPress={() => { setModalVisible(false); setIsEditing(false); setEditingSlot(null); }}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveSlot}><Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Slot'}</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  addBtn: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: 'rgba(255,255,255,0.2)',
  justifyContent: 'center',
  alignItems: 'center',
},
  content: {
  flex: 1,
  flexDirection: 'row',
  backgroundColor: colors.card,
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  overflow: 'hidden',
},
  sidebar: {
  width: 90,
  backgroundColor: colors.surfaceMuted,
  borderRightWidth: 1,
  borderRightColor: colors.border,
},
  dayItem: {
  height: 64,
  justifyContent: 'center',
  alignItems: 'center',
},
selectedDayItem: {
  backgroundColor: colors.primaryFaint,
},
  dayText: {
  fontSize: 16,
  fontWeight: '600',
  color: colors.textSecondary,
},

selectedDayText: {
  color: colors.primary,
  fontWeight: '700',
},
  activeIndicator: { position: 'absolute', left: 0, top: 20, bottom: 20, width: 4, backgroundColor: colors.primary, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  mainContent: {
  flex: 1,
  paddingHorizontal: 18,
  paddingTop: 18,
},
  selectedDayTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: colors.textPrimary,
  marginBottom: 16,
},
  slotsList: { gap: 12 },
  // NOTE: slotCard and rowBack must stay the same height (SLOT_CARD_HEIGHT)
  // so the swipe-revealed edit/delete actions line up behind the card.
  slotCard: {
  backgroundColor: colors.surfaceMuted,
  height: SLOT_CARD_HEIGHT,
  paddingHorizontal: 16,
  borderRadius: 14,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
  borderWidth: 1,
  borderColor: colors.border,
},
inactiveCard: { opacity: 0.5 },
slotTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
timeText: {
  fontSize: 17,
  fontWeight: '600',
  color: colors.textPrimary,
},
  rowBack: { flexDirection: 'row', justifyContent: 'space-between', flex: 1, alignItems: 'center', marginBottom: 12, height: SLOT_CARD_HEIGHT, borderRadius: 14, overflow: 'hidden' },
  backBtn: { width: 75, height: '100%', justifyContent: 'center', alignItems: 'center' },
  editBack: { backgroundColor: colors.primary },
  deleteBack: { backgroundColor: colors.danger },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.card, padding: 20, borderRadius: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  modalBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  saveBtn: { backgroundColor: colors.primary },
  daySelector: { flexDirection: 'row', marginBottom: 16 },
  dayChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.surfaceMuted, marginRight: 8 },
  selectedChip: { backgroundColor: colors.primary },
  chipText: { color: colors.textSecondary, fontWeight: '600' },
  selectedChipText: { color: colors.white },
  cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
  saveBtnText: { color: colors.white, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.textSecondary },
  timeSelector: { flexDirection: 'row', height: 100, alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 8, marginBottom: 16 },
  timeCol: { flex: 1 },
  timeOption: { paddingVertical: 10, alignItems: 'center' },
  selectedTime: { backgroundColor: colors.primaryLight },
  selectedTimeText: { fontWeight: 'bold', color: colors.primary },
  timeSep: { fontSize: 20, fontWeight: 'bold' },
  pickerContainer: { flex: 1, height: 100, backgroundColor: colors.surfaceMuted, borderRadius: 8, overflow: 'hidden' },
  pickerItem: { height: 40, alignItems: 'center', justifyContent: 'center' },
  pickerItemText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  selectionIndicator: { position: 'absolute', top: 30, left: 10, right: 10, height: 40, backgroundColor: 'rgba(74, 144, 226, 0.1)', borderRadius: 8, zIndex: -1 }
});

export default SlotManagementScreen;
