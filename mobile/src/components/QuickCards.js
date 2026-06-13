import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const QuickCard = ({ title, iconName, onPress, bg = '#fff', color = '#1a1a1a', sub = '#9ca3af' }) => {
  return (
    <TouchableOpacity
      style={[styles.box, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <MCIcon name={iconName} size={30} color={color} style={styles.icon} />
      <Text style={[styles.boxTitle, { color }]}>{title}</Text>
      <Text style={[styles.boxSub, { color: sub }]}>Instant relief</Text>
    </TouchableOpacity>
  );
};

export default QuickCard;

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    padding: 16,
    width: '47%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  icon: {
    marginBottom: 10,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  boxSub: {
    fontSize: 12,
    opacity: 0.7,
  },
});
