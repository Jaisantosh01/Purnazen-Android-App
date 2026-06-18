import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

const CORNER = 22;
const BORDER = 3;

// Oval + corner colours per live-quality status.
const STATUS_COLORS = {
  checking: { oval: 'rgba(255,255,255,0.65)', corner: '#C850C0' },
  ready:    { oval: '#22c55e',                corner: '#22c55e' },
  warn:     { oval: '#f59e0b',                corner: '#f59e0b' },
};

/**
 * Full-screen transparent overlay that draws a centred face-guide oval whose
 * colour reflects the live capture-quality status.
 *
 * @param {string} instruction     — hint text shown below the oval
 * @param {'checking'|'ready'|'warn'} status — drives the oval/corner colour
 * @param {number} headerHeight    — height of the floating camera header (px)
 * @param {number} bottomBarHeight — height of the bottom controls bar (px)
 */
const FaceOverlayGuide = ({
  instruction = 'Centre your face in the oval',
  status = 'checking',
  headerHeight = 100,
  bottomBarHeight = 140,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.checking;

  const OVAL_W = W * 0.66;
  const OVAL_H = OVAL_W * 1.3;

  const cameraAreaH = H - headerHeight - bottomBarHeight;
  const ovalTop     = headerHeight + (cameraAreaH - OVAL_H) / 2;
  const ovalLeft    = (W - OVAL_W) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Oval guide */}
      <View
        style={[
          styles.ovalWrapper,
          { top: ovalTop, left: ovalLeft, width: OVAL_W, height: OVAL_H },
        ]}
      >
        <View
          style={[
            styles.oval,
            {
              width: OVAL_W,
              height: OVAL_H,
              borderRadius: OVAL_W / 2,
              borderColor: colors.oval,
              borderWidth: status === 'ready' ? 3.5 : 2.5,
            },
          ]}
        />
        {/* Corner brackets */}
        <View style={[styles.corner, styles.cornerTL, { borderColor: colors.corner }]} />
        <View style={[styles.corner, styles.cornerTR, { borderColor: colors.corner }]} />
        <View style={[styles.corner, styles.cornerBL, { borderColor: colors.corner }]} />
        <View style={[styles.corner, styles.cornerBR, { borderColor: colors.corner }]} />
      </View>

      {/* Instruction label — just below the oval */}
      <View
        style={[
          styles.instructionBox,
          status === 'ready' && styles.instructionReady,
          status === 'warn' && styles.instructionWarn,
          { top: ovalTop + OVAL_H + 20, left: W * 0.08, right: W * 0.08 },
        ]}
      >
        <Text style={styles.instruction}>{instruction}</Text>
      </View>
    </View>
  );
};

export default FaceOverlayGuide;

const styles = StyleSheet.create({
  ovalWrapper: {
    position: 'absolute',
  },
  oval: {
    position: 'absolute',
    top: 0, left: 0,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  cornerTL: { top: -1,  left: -1,  borderTopWidth: BORDER,    borderLeftWidth: BORDER  },
  cornerTR: { top: -1,  right: -1, borderTopWidth: BORDER,    borderRightWidth: BORDER },
  cornerBL: { bottom: -1, left: -1,  borderBottomWidth: BORDER, borderLeftWidth: BORDER  },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  instructionBox: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
  },
  instructionReady: {
    backgroundColor: 'rgba(34,197,94,0.92)',
  },
  instructionWarn: {
    backgroundColor: 'rgba(245,158,11,0.92)',
  },
  instruction: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
