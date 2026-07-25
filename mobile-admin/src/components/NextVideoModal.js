import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

export default function NextVideoModal({ visible, currentTitle, nextTitle, onPlayNext, onCancel, colors }) {
  if (!colors) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.modalSurface, borderColor: colors.modalBorder }]}>
          <MCIcon name="check-circle" size={52} color="#10B981" style={{ marginBottom: 8 }} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Video Completed</Text>

          <View style={[styles.infoRow, { backgroundColor: colors.surfaceMuted }]}>
            <MCIcon name="play-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>{currentTitle}</Text>
          </View>

          {nextTitle && (
            <View style={[styles.infoRow, { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1 }]}>
              <MCIcon name="play-circle" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.textPrimary }]} numberOfLines={1}>Next: {nextTitle}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceMuted }]} onPress={onCancel}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.playBtn, { backgroundColor: colors.primary }]} onPress={onPlayNext}>
              <MCIcon name="play" size={20} color="#fff" />
              <Text style={styles.playText}>Play Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    maxWidth: 360,
    width: '100%',
    alignItems: 'center',
    // Surface + border colours come from the caller (theme-dependent); the
    // edge and lift are what keep the dialog off the dark background.
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    width: '100%',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  playBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  playText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
