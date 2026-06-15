import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

const CORNER = 22;
const BORDER = 3;

/**
 * Full-screen transparent overlay that draws a centred face-guide oval.
 *
 * @param {string}  instruction       — hint text shown below the oval
 * @param {number}  headerHeight      — height of the floating camera header (px)
 * @param {number}  bottomBarHeight   — height of the bottom controls bar (px)
 */
const FaceOverlayGuide = ({
  instruction = 'Centre your face in the oval',
  headerHeight = 100,
  bottomBarHeight = 140,
}) => {
  const { width: W, height: H } = useWindowDimensions();

  const OVAL_W = W * 0.65;
  const OVAL_H = OVAL_W * 1.3;

  // Centre the oval in the camera area between header and bottom bar
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
            { width: OVAL_W, height: OVAL_H, borderRadius: OVAL_W / 2 },
          ]}
        />
        {/* Corner brackets */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      {/* Instruction label — just below the oval */}
      <View
        style={[
          styles.instructionBox,
          { top: ovalTop + OVAL_H + 20, left: W * 0.1, right: W * 0.1 },
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
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#C850C0',
  },
  cornerTL: { top: -1,  left: -1,  borderTopWidth: BORDER,    borderLeftWidth: BORDER  },
  cornerTR: { top: -1,  right: -1, borderTopWidth: BORDER,    borderRightWidth: BORDER },
  cornerBL: { bottom: -1, left: -1,  borderBottomWidth: BORDER, borderLeftWidth: BORDER  },
  cornerBR: { bottom: -1, right: -1, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  instructionBox: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.52)',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  instruction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
