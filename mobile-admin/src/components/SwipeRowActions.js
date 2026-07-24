import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Shared swipe-to-reveal Edit/Delete actions.
 *
 * One source of truth for the gesture the whole admin app uses on list rows,
 * matching the Users/Doctors screens: swipe right reveals a blue **Edit** on
 * the left, swipe left reveals a red **Delete** on the right. Screens used to
 * hand-roll this and had drifted — some single-direction, some using the brand
 * orange for Edit, some icon-only. Route every list row through this component
 * (and the exported open values) so they stay identical.
 *
 * Colours are intentionally fixed hexes, not theme tokens: Edit/Delete carry a
 * conventional blue/red meaning that shouldn't shift with the brand palette,
 * and both sit under white glyphs that stay legible in light and dark.
 */

export const SWIPE_EDIT_COLOR = '#3B82F6';
export const SWIPE_DELETE_COLOR = '#EF4444';
export const SWIPE_BTN_WIDTH = 75;
export const SWIPE_LEFT_OPEN = 80;
export const SWIPE_RIGHT_OPEN = -80;

const SwipeRowActions = ({
  onEdit,
  onDelete,
  onClose,
  editLabel = 'Edit',
  editIcon = 'pencil',
  deleteLabel = 'Delete',
  deleteIcon = 'delete',
  containerStyle,
}) => {
  const run = (fn) => {
    onClose?.();
    fn?.();
  };
  return (
    <View style={[styles.rowBack, containerStyle]}>
      {onEdit ? (
        <TouchableOpacity style={[styles.backBtn, styles.editBack]} onPress={() => run(onEdit)}>
          <MCIcon name={editIcon} size={22} color="#fff" />
          <Text style={styles.backBtnText}>{editLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
      {onDelete ? (
        <TouchableOpacity style={[styles.backBtn, styles.deleteBack]} onPress={() => run(onDelete)}>
          <MCIcon name={deleteIcon} size={22} color="#fff" />
          <Text style={styles.backBtnText}>{deleteLabel}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.backBtn} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  rowBack: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backBtn: {
    width: SWIPE_BTN_WIDTH,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  editBack: { backgroundColor: SWIPE_EDIT_COLOR },
  deleteBack: { backgroundColor: SWIPE_DELETE_COLOR },
  backBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});

export default SwipeRowActions;
