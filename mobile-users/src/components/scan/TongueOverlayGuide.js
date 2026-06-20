import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

const CORNER = 18;
const BORDER = 3;

// Oval + corner colours per live-quality status.
const STATUS_COLORS = {
  checking: { oval: 'rgba(255,255,255,0.70)', corner: '#fa7921' },
  ready:    { oval: '#22c55e',                corner: '#22c55e' },
  warn:     { oval: '#f59e0b',                corner: '#f59e0b' },
};

/**
 * Full-screen transparent overlay that draws a centred tongue-guide oval.
 * The oval is wider and shorter than the face oval — sized for an open mouth
 * with the tongue extended. Colour reflects the live capture-quality status.
 *
 * @param {string} instruction     — hint text shown below the oval
 * @param {'checking'|'ready'|'warn'} status — drives the oval/corner colour
 * @param {number} headerHeight    — height of the floating camera header (px)
 * @param {number} bottomBarHeight — height of the bottom controls bar (px)
 */
const TongueOverlayGuide = ({
  instruction = 'Stick out your tongue and centre it',
  status = 'checking',
  headerHeight = 100,
  bottomBarHeight = 140,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.checking;

  // Tongue oval: wider than face oval, shorter vertically
  const OVAL_W = W * 0.62;
  const OVAL_H = OVAL_W * 0.55;

  const cameraAreaH = H - headerHeight - bottomBarHeight;
  // Shift slightly down from centre (tongue is in the lower portion of frame)
  const ovalTop  = headerHeight + (cameraAreaH - OVAL_H) / 2 + cameraAreaH * 0.08;
  const ovalLeft = (W - OVAL_W) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Dim overlay above/below the oval to focus attention */}
      <View style={[styles.dim, { top: 0, height: ovalTop }]} />
      <View style={[styles.dim, { top: ovalTop + OVAL_H, bottom: 0 }]} />

      {/* Tongue oval guide */}
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
          { top: ovalTop + OVAL_H + 18, left: W * 0.08, right: W * 0.08 },
        ]}
      >
        <Text style={styles.instruction}>{instruction}</Text>
      </View>

      {/* Tip row above the oval */}
      <View
        style={[
          styles.tipBox,
          { bottom: H - ovalTop + 14, left: W * 0.08, right: W * 0.08 },
        ]}
      >
        <Text style={styles.tip}>Open wide · bright light · still</Text>
      </View>
    </View>
  );
};

export default TongueOverlayGuide;

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  ovalWrapper: {
    position: 'absolute',
  },
  oval: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  cornerTL: { top: -1,    left: -1,   borderTopWidth: BORDER,    borderLeftWidth: BORDER  },
  cornerTR: { top: -1,    right: -1,  borderTopWidth: BORDER,    borderRightWidth: BORDER },
  cornerBL: { bottom: -1, left: -1,   borderBottomWidth: BORDER, borderLeftWidth: BORDER  },
  cornerBR: { bottom: -1, right: -1,  borderBottomWidth: BORDER, borderRightWidth: BORDER },

  instructionBox: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
  },
  instructionReady: { backgroundColor: 'rgba(34,197,94,0.92)' },
  instructionWarn:  { backgroundColor: 'rgba(245,158,11,0.92)' },
  instruction: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  tipBox: {
    position: 'absolute',
    alignItems: 'center',
  },
  tip: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
