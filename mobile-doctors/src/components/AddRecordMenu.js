import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const MENU_ITEMS = [
  { screenName: 'DoctorNotesEditor', label: 'Doctor Notes', icon: 'note-text-outline' },
  { screenName: 'DiagnosisEditor', label: 'Diagnosis', icon: 'stethoscope' },
  { screenName: 'PrescriptionEditor', label: 'Prescription', icon: 'pill' },
];

/**
 * Bottom-sheet menu for the "+" button.
 * All options are always selectable — multiple entries per type are allowed.
 */
const AddRecordMenu = ({ visible, onClose, onSelect }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.sheet}>
        <Text style={styles.title}>Add Clinical Record</Text>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity
            key={item.screenName}
            style={styles.option}
            activeOpacity={0.85}
            onPress={() => { onSelect(item.screenName); onClose(); }}>
            <View style={styles.iconWrap}>
              <MCIcon name={item.icon} size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.optionText}>{item.label}</Text>
            <View style={styles.addBadge}>
              <MCIcon name="plus" size={14} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  </Modal>
);

export default AddRecordMenu;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: 36,
    gap: SPACING.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 13,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  addBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
