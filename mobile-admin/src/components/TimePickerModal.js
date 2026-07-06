import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const TimePickerModal = ({ visible, onClose, onSelect, initialTime }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const parsed = initialTime
    ? {
        h: parseInt(initialTime.split(':')[0]) || 9,
        m: initialTime.split(':')[1]?.slice(0, 2) || '00',
        ampm: initialTime.includes('PM') ? 'PM' : 'AM',
      }
    : { h: 9, m: '00', ampm: 'AM' };

  const [hour, setHour] = useState(parsed.h);
  const [minute, setMinute] = useState(parsed.m);
  const [meridiem, setMeridiem] = useState(parsed.ampm);

  useEffect(() => {
    const p = initialTime
      ? {
          h: parseInt(initialTime.split(':')[0]) || 9,
          m: initialTime.split(':')[1]?.slice(0, 2) || '00',
          ampm: initialTime.includes('PM') ? 'PM' : 'AM',
        }
      : { h: 9, m: '00', ampm: 'AM' };
    setHour(p.h);
    setMinute(p.m);
    setMeridiem(p.ampm);
  }, [initialTime]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <MCIcon name="clock-outline" size={22} color={colors.primary} />
            <Text style={styles.title}>Select Time</Text>
          </View>
          <View style={styles.cols}>
            <View style={styles.col}>
              <Text style={styles.colLabel}>Hour</Text>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {HOURS.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.item, hour === h && styles.itemActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.itemText, hour === h && styles.itemTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.col}>
              <Text style={styles.colLabel}>Min</Text>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {MINUTES.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.item, minute === m && styles.itemActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.itemText, minute === m && styles.itemTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.col}>
              <Text style={styles.colLabel}>AM/PM</Text>
              <View style={styles.ampmCol}>
                {['AM', 'PM'].map(ap => (
                  <TouchableOpacity
                    key={ap}
                    style={[styles.item, meridiem === ap && styles.itemActive]}
                    onPress={() => setMeridiem(ap)}
                  >
                    <Text style={[styles.itemText, meridiem === ap && styles.itemTextActive]}>
                      {ap}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                onSelect(`${hour}:${minute} ${meridiem}`);
                onClose();
              }}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = colors => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  container: { backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  cols: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, alignItems: 'center' },
  colLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 8, textTransform: 'uppercase' },
  list: { maxHeight: 200 },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    minWidth: 60,
  },
  itemActive: { backgroundColor: colors.primary },
  itemText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  itemTextActive: { color: colors.white },
  ampmCol: { gap: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.surfaceMuted },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  doneBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: colors.primary },
  doneText: { fontSize: 14, fontWeight: '700', color: colors.white },
});

export default TimePickerModal;
