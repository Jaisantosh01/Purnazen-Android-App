import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import { COLORS } from '../constants/theme';
import FaceMeshOverlay from '../components/scan/FaceMeshOverlay';

// Ordered feature steps shown to the user. `zone` maps to FaceMeshOverlay
// highlight; the list is revealed progressively, gated by real backend stage.
const STEPS = [
  { key: 'detect',     label: 'Detecting your face',   zone: 'all' },
  { key: 'forehead',   label: 'Analysing forehead',    zone: 'forehead' },
  { key: 'cheeks',     label: 'Analysing cheeks',      zone: 'cheeks' },
  { key: 'under_eyes', label: 'Checking under-eyes',   zone: 'under_eyes' },
  { key: 't_zone',     label: 'Analysing T-zone',      zone: 't_zone' },
  { key: 'jawline',    label: 'Analysing jaw & skin',  zone: 'jawline' },
  { key: 'scoring',    label: 'Computing your scores', zone: 'all' },
];

// How many steps are allowed to be COMPLETE given the backend's real stage.
// Keeps the animation honest — it never claims a feature is done before the
// pipeline actually got there.
function completedCap(stage, status) {
  if (status === 'completed') return STEPS.length;
  switch (stage) {
    case 'analyzing': return STEPS.length - 1; // detect + all features, scoring still running
    case 'scoring':   return STEPS.length - 1;
    default:          return 0;                 // queued / preprocessing / detecting
  }
}

const STEP_MS = 520;

const ScanProcessingScreen = ({ navigation, route }) => {
  const { scanId, scanType, imageUri } = route.params;
  const setLatestScan = useScanStore(s => s.setLatestScan);
  const setProcessing = useScanStore(s => s.setProcessing);
  const prependHistory = useScanStore(s => s.prependHistory);

  const [doneCount, setDoneCount] = useState(0);
  const [landmarks, setLandmarks] = useState(null);
  const [aspect, setAspect] = useState(3 / 4);
  const [box, setBox] = useState({ w: 0, h: 0 });

  // Mutable poll state read by the ticker.
  const stageRef = useRef('queued');
  const statusRef = useRef('processing');
  const finalRef = useRef(null);   // final payload once completed
  const failedRef = useRef(null);  // friendly message once failed

  useEffect(() => {
    let cancelled = false;

    // 1. Poll the backend; update stage + landmarks on every tick.
    scanService
      .pollScanStatus(scanId, {
        onStatus: payload => {
          if (cancelled) return;
          stageRef.current = payload.progress_stage || stageRef.current;
          statusRef.current = payload.status;
          if (payload.landmarks) setLandmarks(payload.landmarks);
          if (payload.image_width && payload.image_height) {
            setAspect(payload.image_width / payload.image_height);
          }
        },
      })
      .then(payload => {
        if (cancelled) return;
        if (payload.status === 'completed') {
          finalRef.current = payload;
          if (payload.landmarks) setLandmarks(payload.landmarks);
        } else {
          failedRef.current = payload.error_message || "We couldn't analyse this scan. Please try again.";
        }
      })
      .catch(() => {
        if (cancelled) return;
        failedRef.current = 'This is taking longer than expected. Please try again.';
      });

    // 2. Ticker advances the visible checklist, gated by real progress.
    const ticker = setInterval(() => {
      if (cancelled) return;

      if (failedRef.current) {
        clearInterval(ticker);
        setProcessing(false);
        navigation.replace('ScanError', { message: failedRef.current, scanType });
        return;
      }

      setDoneCount(prev => {
        const cap = completedCap(stageRef.current, statusRef.current);
        const next = prev < cap ? prev + 1 : prev;

        // All steps shown and results are in → go to results.
        if (next >= STEPS.length && finalRef.current) {
          clearInterval(ticker);
          const payload = finalRef.current;
          setLatestScan(payload);
          setProcessing(false);
          prependHistory({
            id: payload.scan_id,
            scanType: payload.scan_type,
            status: 'completed',
            glowScore: payload.results?.glowScore ?? null,
            overallWellnessScore: payload.results?.overallWellnessScore ?? null,
            imageUrl: null,
            createdAt: payload.created_at,
          });
          navigation.replace('ScanResults', { scan: payload });
        }
        return next;
      });
    }, STEP_MS);

    return () => {
      cancelled = true;
      clearInterval(ticker);
    };
  }, [navigation, scanId, scanType, setLatestScan, setProcessing, prependHistory]);

  const inProgressIndex = Math.min(doneCount, STEPS.length - 1);
  const activeZone = STEPS[inProgressIndex]?.zone ?? 'all';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <Text style={styles.heading}>Analysing your scan</Text>
      <Text style={styles.subtext}>Hold tight — this takes a few seconds</Text>

      {/* Captured still + live mesh overlay */}
      <View
        style={[styles.imageCard, { aspectRatio: aspect }]}
        onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.imageFallback]}>
            <MCIcon name="face-recognition" size={48} color={COLORS.primary} />
          </View>
        )}
        <FaceMeshOverlay landmarks={landmarks} activeZone={activeZone} width={box.w} height={box.h} />
      </View>

      {/* Feature checklist */}
      <View style={styles.steps}>
        {STEPS.map((step, i) => {
          const done = i < doneCount;
          const active = i === inProgressIndex && doneCount < STEPS.length;
          return (
            <View key={step.key} style={styles.stepRow}>
              {done ? (
                <MCIcon name="check-circle" size={20} color={COLORS.primary} />
              ) : active ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <MCIcon name="circle-outline" size={20} color={COLORS.textMuted} />
              )}
              <Text style={[styles.stepText, (done || active) && styles.stepTextActive]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default ScanProcessingScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 64,
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  imageCard: {
    width: '72%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdf4ff',
  },
  steps: {
    marginTop: 26,
    alignSelf: 'stretch',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  stepTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
});
