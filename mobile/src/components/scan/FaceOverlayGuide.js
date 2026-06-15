import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const OVAL_W = SCREEN_W * 0.65;
const OVAL_H = OVAL_W * 1.3;

const FaceOverlayGuide = ({ instruction = 'Centre your face in the oval' }) => (
  <View style={styles.overlay} pointerEvents="none">
    <View style={styles.ovalWrapper}>
      <View style={styles.oval} />
      <View style={styles.cornerTL} />
      <View style={styles.cornerTR} />
      <View style={styles.cornerBL} />
      <View style={styles.cornerBR} />
    </View>
    <View style={styles.instructionBox}>
      <Text style={styles.instruction}>{instruction}</Text>
    </View>
  </View>
);

export default FaceOverlayGuide;

const CORNER = 22;
const BORDER = 3;

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ovalWrapper: {
    width: OVAL_W,
    height: OVAL_H,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'transparent',
  },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: CORNER, height: CORNER, borderTopWidth: BORDER, borderLeftWidth: BORDER, borderColor: '#C850C0' },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: CORNER, height: CORNER, borderTopWidth: BORDER, borderRightWidth: BORDER, borderColor: '#C850C0' },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: CORNER, height: CORNER, borderBottomWidth: BORDER, borderLeftWidth: BORDER, borderColor: '#C850C0' },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: CORNER, height: CORNER, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderColor: '#C850C0' },
  instructionBox: {
    marginTop: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  instruction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
