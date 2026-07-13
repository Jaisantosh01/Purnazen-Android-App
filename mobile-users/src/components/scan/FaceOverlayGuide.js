import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

// Guide ring + accent colours per live-quality status.
const STATUS_COLORS = {
  checking: { oval: 'rgba(255,255,255,0.9)', glow: '#ffffff' },
  ready:    { oval: '#22c55e',               glow: '#22c55e' },
  warn:     { oval: '#f59e0b',               glow: '#f59e0b' },
};

const SCRIM = 'rgba(6, 8, 16, 0.62)';

/** SVG path: full-screen rect with an elliptical hole (evenodd fill). */
function scrimPath(W, H, cx, cy, rx, ry) {
  return (
    `M0 0H${W}V${H}H0Z ` +
    `M${cx - rx} ${cy}` +
    `a${rx} ${ry} 0 1 0 ${rx * 2} 0` +
    `a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`
  );
}

/** One live-check chip (Lighting / Position / Clarity). */
const CheckChip = ({ icon, label, state }) => {
  const pass = state === true;
  const unknown = state === null || state === undefined;
  return (
    <View style={[styles.chip, pass && styles.chipPass]}>
      <MCIcon
        name={pass ? 'check-circle' : icon}
        size={13}
        color={pass ? '#22c55e' : unknown ? 'rgba(255,255,255,0.55)' : '#f59e0b'}
      />
      <Text style={[styles.chipText, pass && styles.chipTextPass]}>{label}</Text>
    </View>
  );
};

/**
 * Full-screen camera overlay: dimmed scrim with an elliptical face cut-out,
 * a status-coloured guide ring (soft breathing glow when ready), per-check
 * chips, the instruction pill, an auto-capture countdown and an on-device
 * privacy badge.
 *
 * @param {string} instruction     — hint text shown below the oval
 * @param {'checking'|'ready'|'warn'} status — drives colours
 * @param {number} headerHeight    — height of the floating camera header (px)
 * @param {number} bottomBarHeight — height of the bottom controls bar (px)
 * @param {number|null} countdown  — seconds left before auto-capture (null = off)
 * @param {{lighting:boolean|null, position:boolean|null, clarity:boolean|null}|null} checks
 * @param {boolean} onDevice       — true when checks run locally (privacy badge)
 */
const FaceOverlayGuide = ({
  instruction = 'Centre your face in the oval',
  status = 'checking',
  headerHeight = 100,
  bottomBarHeight = 140,
  countdown = null,
  checks = null,
  onDevice = false,
}) => {
  const { width: W, height: H } = useWindowDimensions();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.checking;

  const OVAL_W = W * 0.68;
  const OVAL_H = OVAL_W * 1.28;
  const cameraAreaH = H - headerHeight - bottomBarHeight;
  const cy = headerHeight + cameraAreaH / 2 - 8;
  const cx = W / 2;
  const rx = OVAL_W / 2;
  const ry = OVAL_H / 2;

  // Soft breathing glow around the ring while ready.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (status === 'ready') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
  }, [status, pulse]);

  // Pop-in animation for each countdown tick.
  const tickScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (countdown != null) {
      tickScale.setValue(1.5);
      Animated.spring(tickScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    }
  }, [countdown, tickScale]);

  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });

  // Local SVG box for the halo ellipse (padded so the stroke isn't clipped).
  const HALO_PAD = 14;
  const haloW = OVAL_W + HALO_PAD * 2;
  const haloH = OVAL_H + HALO_PAD * 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Dimmed scrim with elliptical cut-out + guide ring */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Path d={scrimPath(W, H, cx, cy, rx, ry)} fill={SCRIM} fillRule="evenodd" />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          stroke={colors.oval}
          strokeWidth={status === 'ready' ? 3.5 : 2.5}
          fill="none"
        />
      </Svg>

      {/* Breathing glow halo (ready state only) */}
      {status === 'ready' && (
        <Animated.View
          style={{
            position: 'absolute',
            left: cx - haloW / 2,
            top: cy - haloH / 2,
            width: haloW,
            height: haloH,
            opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          }}
        >
          <Svg width={haloW} height={haloH}>
            <Ellipse
              cx={haloW / 2}
              cy={haloH / 2}
              rx={rx + 7}
              ry={ry + 7}
              stroke={colors.glow}
              strokeWidth={8}
              fill="none"
            />
          </Svg>
        </Animated.View>
      )}

      {/* Auto-capture countdown */}
      {countdown != null && (
        <View style={[styles.countdownWrap, { left: 0, right: 0, top: cy - 54 }]}>
          <Animated.Text style={[styles.countdownText, { transform: [{ scale: tickScale }] }]}>
            {countdown}
          </Animated.Text>
          <Text style={styles.countdownSub}>Hold still</Text>
        </View>
      )}

      {/* Instruction pill */}
      <View
        style={[
          styles.instructionBox,
          status === 'ready' && styles.instructionReady,
          status === 'warn' && styles.instructionWarn,
          { top: cy + ry + 18, left: W * 0.08, right: W * 0.08 },
        ]}
      >
        <Text style={styles.instruction}>{instruction}</Text>
      </View>

      {/* Live check chips */}
      {checks && (
        <View style={[styles.chipsRow, { top: cy + ry + 64, left: 0, right: 0 }]}>
          <CheckChip icon="white-balance-sunny" label="Lighting" state={checks.lighting} />
          <CheckChip icon="face-recognition" label="Position" state={checks.position} />
          <CheckChip icon="blur" label="Clarity" state={checks.clarity} />
        </View>
      )}

      {/* On-device privacy badge */}
      {onDevice && (
        <View style={[styles.privacyBadge, { top: headerHeight + 10, left: 0, right: 0 }]}>
          <View style={styles.privacyPill}>
            <MCIcon name="shield-check" size={12} color="#4ade80" />
            <Text style={styles.privacyText}>Live checks run on your device</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default FaceOverlayGuide;

const styles = StyleSheet.create({
  countdownWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 76,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  countdownSub: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  instructionBox: {
    position: 'absolute',
    backgroundColor: 'rgba(10,12,20,0.72)',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  instructionReady: { backgroundColor: 'rgba(22,101,52,0.90)', borderColor: 'rgba(74,222,128,0.5)' },
  instructionWarn:  { backgroundColor: 'rgba(120,53,15,0.90)', borderColor: 'rgba(251,191,36,0.5)' },
  instruction: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipsRow: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10,12,20,0.65)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  chipPass: {
    backgroundColor: 'rgba(20,55,35,0.75)',
    borderColor: 'rgba(74,222,128,0.35)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11.5,
    fontWeight: '600',
  },
  chipTextPass: { color: '#bbf7d0' },
  privacyBadge: {
    position: 'absolute',
    alignItems: 'center',
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10,12,20,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  privacyText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
});
