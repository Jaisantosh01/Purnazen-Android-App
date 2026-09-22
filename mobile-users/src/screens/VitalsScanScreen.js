import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import Svg, { Polyline } from 'react-native-svg';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { checkCaptureQuality, hasOnDeviceQuality } from '../services/scanQualityService';
import { hasRoiMeansPlugin, roiMeans } from '../services/rppg/frameProcessor';
import { estimateHeartRate, estimateRespiration } from '../services/rppg/estimate';
import { detrend } from '../services/rppg/signal';
import FaceOverlayGuide from '../components/scan/FaceOverlayGuide';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import useTheme from '../hooks/useTheme';

/**
 * Vitals scan — heart rate and breathing rate from the front camera (rPPG).
 *
 * Flow: align (same live quality gate as the face scan) → measure (30 s of
 * per-frame ROI colour means, only while the face is in the oval) → result.
 * Nothing is uploaded; the video never leaves the phone and the estimate runs
 * here in JS. Numbers are withheld when the signal quality is poor, and a
 * fair reading can be extended by 10 s — longer windows are the cheapest
 * accuracy there is.
 *
 * Known gap: VisionCamera 4 exposes exposure *bias* but not an AE/AWB lock, so
 * auto-exposure can still drift in the pulse band under changing light. Even,
 * steady lighting is what the guidance asks for.
 */
const TARGET_SECONDS = 30;
const EXTEND_SECONDS = 10;
const FPS = 30;
const QUALITY_INTERVAL_MS = hasOnDeviceQuality ? 900 : 2200;
const READY_STREAK = 2;
const TRACE_SECONDS = 6;
const ACCENT = '#C850C0';

const GUIDANCE = {
  no_face: 'Bring your face into the oval',
  multiple_faces: 'Only one face in the oval, please',
  face_too_small: 'Move a little closer',
  off_center: 'Align your face inside the oval',
  not_frontal: 'Look straight at the camera',
  too_dark: 'Find brighter, even lighting',
  too_bright: 'Too bright — avoid glare or backlight',
  too_blurry: 'Hold still',
};

function deriveQuality(issues) {
  if (issues === null) return { status: 'checking', message: 'Detecting your face…' };
  if (issues.length === 0) return { status: 'ready', message: 'Hold still — measuring' };
  const top = issues.find(i => i.blocking) || issues[0];
  return { status: 'warn', message: GUIDANCE[top.code] || top.guidance || 'Align your face in the oval' };
}

function deriveChecks(issues) {
  if (issues === null) return null;
  const has = c => issues.some(i => i.code === c);
  return {
    lighting: !has('too_dark') && !has('too_bright'),
    position: !has('no_face') && !has('multiple_faces') && !has('face_too_small') && !has('off_center') && !has('not_frontal'),
    clarity: !has('too_blurry'),
  };
}

/** Last few seconds of the green channel, detrended, as an SVG polyline. */
function PulseTrace({ samples, width, height }) {
  const points = useMemo(() => {
    const n = Math.min(samples.length, TRACE_SECONDS * FPS);
    if (n < FPS) return '';
    const g = detrend(samples.slice(-n).map(s => s.g), FPS);
    const max = Math.max(...g.map(Math.abs), 1e-6);
    return g.map((v, i) => `${(i / (n - 1)) * width},${height / 2 - (v / max) * (height / 2 - 4)}`).join(' ');
  }, [samples, width, height]);
  if (!points) return null;
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

const QUALITY_LABEL = { good: 'Good signal', fair: 'Fair signal', poor: 'Signal too weak' };

const VitalsScanScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors, insets), [colors, insets]);

  const cameraRef = useRef(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  // 720p is plenty for a colour mean and keeps every frame cheap.
  const format = useCameraFormat(device, [{ fps: FPS }, { videoResolution: { width: 1280, height: 720 } }]);

  const [phase, setPhase] = useState('align');           // align | measure | result
  const [target, setTarget] = useState(TARGET_SECONDS);
  const [headerH, setHeaderH] = useState(106);
  const [qualityIssues, setQualityIssues] = useState(null);
  const [kept, setKept] = useState(0);                   // samples kept so far
  const [result, setResult] = useState(null);
  const [traceTick, setTraceTick] = useState(0);

  const samples = useRef([]);
  const gateOpen = useRef(false);                        // latest quality verdict was "ready"
  const readyStreak = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (!hasPermission) requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live quality gate (same checks as the face scan, ~1 Hz) ───────────────
  useEffect(() => {
    if (!hasPermission || !device || phase === 'result') return;
    let cancelled = false;
    let running = false;
    const run = async () => {
      if (running || cancelled || !cameraRef.current) return;
      running = true;
      try {
        const photo = await cameraRef.current.takeSnapshot({ quality: 50 });
        if (cancelled) return;
        const res = await checkCaptureQuality(`file://${photo.path}`, 'face');
        if (cancelled) return;
        const issues = res?.issues ?? [];
        setQualityIssues(issues);
        const ready = !issues.some(i => i.blocking);
        gateOpen.current = ready;
        readyStreak.current = ready ? readyStreak.current + 1 : 0;
        if (phaseRef.current === 'align' && readyStreak.current >= READY_STREAK) setPhase('measure');
      } catch {
        // keep the last verdict
      } finally {
        running = false;
      }
    };
    const iv = setInterval(run, QUALITY_INTERVAL_MS);
    const warm = setTimeout(run, 500);
    return () => { cancelled = true; clearInterval(iv); clearTimeout(warm); };
  }, [hasPermission, device, phase]);

  // ── Per-frame samples from the native plugin ───────────────────────────────
  const onSample = useMemo(() => Worklets.createRunOnJS(s => {
    if (phaseRef.current !== 'measure' || !gateOpen.current || !s || s.error) return;
    samples.current.push(s);
    const n = samples.current.length;
    if (n % 5 === 0) setKept(n);
    if (n % 15 === 0) setTraceTick(n);
  }), []);

  const frameProcessor = useFrameProcessor(frame => {
    'worklet';
    const s = roiMeans(frame);
    if (s) onSample(s);
  }, [onSample]);

  // ── Finish when enough good samples are in ────────────────────────────────
  useEffect(() => {
    if (phase !== 'measure' || kept < target * FPS) return;
    const s = samples.current;
    setResult({ hr: estimateHeartRate(s, { fs: FPS }), rr: estimateRespiration(s, { fs: FPS }) });
    setPhase('result');
  }, [kept, target, phase]);

  const restart = useCallback(() => {
    samples.current = [];
    readyStreak.current = 0;
    setKept(0); setResult(null); setTarget(TARGET_SECONDS); setQualityIssues(null);
    setPhase('align');
  }, []);

  const extend = useCallback(() => {
    setTarget(t => t + EXTEND_SECONDS);
    setResult(null);
    setPhase('measure');
  }, []);

  const quality = deriveQuality(qualityIssues);
  const seconds = Math.min(target, Math.floor(kept / FPS));
  const instruction = phase === 'measure'
    ? (quality.status === 'ready' ? `Hold still — ${seconds}/${target} s` : `Paused — ${quality.message}`)
    : quality.message;

  // ── Unsupported build / no permission ─────────────────────────────────────
  if (!hasRoiMeansPlugin || !hasPermission) {
    const noPlugin = !hasRoiMeansPlugin;
    return (
      <View style={styles.rootThemed}>
        <StatusBar barStyle="light-content" backgroundColor={ACCENT} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vitals Scan</Text>
          <View style={styles.w38} />
        </View>
        <View style={styles.permissionBody}>
          <MCIcon name={noPlugin ? 'heart-pulse' : 'camera-off'} size={64} color={`${ACCENT}66`} />
          <Text style={styles.permTitle}>{noPlugin ? 'Not available in this build' : 'Camera access required'}</Text>
          <Text style={styles.permSub}>
            {noPlugin
              ? 'The on-device pulse reader is not included in this version of the app.'
              : 'Purnazen needs the front camera to read your pulse from tiny changes in skin colour. Nothing is recorded or uploaded.'}
          </Text>
          {!noPlugin && (
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Allow camera</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const { hr, rr } = result;
    const canExtend = hr.quality !== 'good' && target < TARGET_SECONDS + 2 * EXTEND_SECONDS;
    return (
      <View style={styles.rootThemed}>
        <StatusBar barStyle="light-content" backgroundColor={ACCENT} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vitals Scan</Text>
          <View style={styles.w38} />
        </View>
        <View style={styles.resultBody}>
          <View style={styles.vitalRow}>
            <VitalCard styles={styles} icon="heart-pulse" label="Heart rate" unit="bpm"
              value={hr.bpm} quality={hr.quality} />
            <VitalCard styles={styles} icon="lungs" label="Breathing" unit="/min"
              value={rr.brpm} quality={rr.quality} />
          </View>
          <Text style={styles.resultMeta}>
            {Math.round(hr.seconds)} s of usable signal · pulse SNR {hr.snrDb.toFixed(1)} dB
          </Text>
          {hr.quality === 'poor' && (
            <Text style={styles.resultHint}>
              The pulse signal was too weak to report a number. Try even, bright light, keep still, and rest your phone on something.
            </Text>
          )}
          <View style={styles.resultActions}>
            {canExtend && (
              <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={extend} activeOpacity={0.85}>
                <MCIcon name="timer-plus-outline" size={18} color="#fff" />
                <Text style={styles.actionPrimaryText}>Measure {EXTEND_SECONDS} s more</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={restart} activeOpacity={0.85}>
              <MCIcon name="refresh" size={18} color={colors.textPrimary} />
              <Text style={styles.actionText}>Measure again</Text>
            </TouchableOpacity>
          </View>
          <MedicalDisclaimer style={styles.disclaimer} />
        </View>
      </View>
    );
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        fps={FPS}
        pixelFormat="yuv"
        isActive={phase !== 'result'}
        frameProcessor={frameProcessor}
      />
      <FaceOverlayGuide
        instruction={instruction}
        status={quality.status}
        headerHeight={headerH}
        bottomBarHeight={170}
        checks={deriveChecks(qualityIssues)}
        onDevice={hasOnDeviceQuality}
      />
      <View style={styles.cameraHeader} onLayout={e => setHeaderH(e.nativeEvent.layout.height)}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vitals Scan</Text>
        <View style={styles.w38} />
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.traceBox}>
          <PulseTrace key={traceTick} samples={samples.current} width={W - 64} height={48} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, (kept / (target * FPS)) * 100)}%` }]} />
        </View>
        <Text style={styles.bottomText}>
          {phase === 'measure' ? `${seconds} of ${target} s` : 'Line up your face to begin'} · nothing is uploaded
        </Text>
      </View>
    </View>
  );
};

function VitalCard({ styles, icon, label, unit, value, quality }) {
  const withheld = value == null;
  return (
    <View style={styles.vitalCard} accessibilityLabel={`${label} ${withheld ? 'not available' : Math.round(value) + ' ' + unit}, ${QUALITY_LABEL[quality]}`}>
      <MCIcon name={icon} size={26} color={ACCENT} />
      <Text style={styles.vitalValue}>{withheld ? '—' : Math.round(value)}</Text>
      <Text style={styles.vitalUnit}>{unit}</Text>
      <Text style={styles.vitalLabel}>{label}</Text>
      <View style={[styles.qualityChip, styles[`quality_${quality}`]]}>
        <Text style={styles.qualityChipText}>{QUALITY_LABEL[quality]}</Text>
      </View>
    </View>
  );
}

export default VitalsScanScreen;

const makeStyles = (colors, insets) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  rootThemed: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: ACCENT, paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cameraHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingBottom: 14,
    paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  w38: { width: 38 },
  permissionBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  permTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  permSub: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  permBtn: { marginTop: 8, backgroundColor: ACCENT, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 24 },
  permBtnText: { color: '#fff', fontWeight: '700' },
  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 16, paddingTop: 12,
    paddingHorizontal: 32, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', gap: 10,
  },
  traceBox: { height: 48, width: '100%', justifyContent: 'center' },
  progressTrack: { height: 6, width: '100%', borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#22c55e' },
  bottomText: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5 },
  resultBody: { flex: 1, padding: 20, gap: 14 },
  vitalRow: { flexDirection: 'row', gap: 12 },
  vitalCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.surfaceMuted,
  },
  vitalValue: { fontSize: 40, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'], marginTop: 6 },
  vitalUnit: { fontSize: 12, color: colors.textMuted, marginTop: -4 },
  vitalLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 4 },
  qualityChip: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  quality_good: { backgroundColor: '#dcefe2' },
  quality_fair: { backgroundColor: '#f7ecd4' },
  quality_poor: { backgroundColor: '#f6e3e7' },
  qualityChipText: { fontSize: 11, fontWeight: '700', color: '#333' },
  resultMeta: { fontSize: 12.5, color: colors.textMuted, textAlign: 'center' },
  resultHint: { fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 8 },
  resultActions: { gap: 10, marginTop: 6 },
  actionBtn: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13,
    borderRadius: 26, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.surfaceMuted,
  },
  actionPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },
  actionPrimaryText: { color: '#fff', fontWeight: '700' },
  actionText: { color: colors.textPrimary, fontWeight: '700' },
  disclaimer: { marginTop: 'auto' },
});
