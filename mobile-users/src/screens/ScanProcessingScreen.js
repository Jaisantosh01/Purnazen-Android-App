import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import useTheme from '../hooks/useTheme';
import FaceMeshOverlay from '../components/scan/FaceMeshOverlay';

// Compute a normalized crop box {x, y, w, h} that frames the detected face/tongue
// with padding, clamped to the image bounds so we never reveal empty edges.
// padX/padY are extra fractions of the detected box added on each side.
function padClamp(minX, minY, maxX, maxY, padX, padY) {
  const bw = maxX - minX;
  const bh = maxY - minY;
  let x = minX - bw * padX;
  let y = minY - bh * padY;
  let w = bw * (1 + 2 * padX);
  let h = bh * (1 + 2 * padY);
  // Clamp to [0,1]
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  // Guard against degenerate boxes (detector noise) — fall back to a sane region.
  if (w < 0.2 || h < 0.2) return null;
  return { x, y, w, h };
}

// Derive the crop box from whatever the backend gave us (full mesh or a bbox).
function computeCrop(landmarks) {
  if (landmarks?.type === 'mesh' && Array.isArray(landmarks.points) && landmarks.points.length) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const p of landmarks.points) {
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    // Generous padding so forehead/chin/ears stay in frame.
    return padClamp(minX, minY, maxX, maxY, 0.22, 0.30);
  }
  if (landmarks?.type === 'bbox' && Array.isArray(landmarks.rect)) {
    const [x, y, w, h] = landmarks.rect;
    return padClamp(x, y, x + w, y + h, 0.16, 0.20);
  }
  return null;
}

// Soft radial vignette over the card edges — fakes a shallow-depth background
// so the cropped face/tongue pops (display-only, the live approximation of the
// server-side background blur shown on the results screen).
function CardVignette({ width, height }) {
  if (!width || !height) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="vig" cx="50%" cy="46%" rx="62%" ry="62%">
          <Stop offset="55%" stopColor="#000" stopOpacity="0" />
          <Stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#vig)" />
    </Svg>
  );
}

// ── Feature chips ─────────────────────────────────────────────────────────────

const FACE_FEATURES = [
  { key: 'enhance',  icon: 'auto-fix',                 label: 'Enhance',     desc: 'Balancing colour & lighting for an accurate read',  zone: 'all'       },
  { key: 'detect',   icon: 'face-recognition',         label: 'Face map',    desc: 'Mapping your 478 facial landmarks',                 zone: 'all'       },
  { key: 'hydration',icon: 'water-outline',            label: 'Hydration',   desc: 'Skin moisture from cheek tone & texture',           zone: 'cheeks'    },
  { key: 'oil',      icon: 'blur',                     label: 'Oil & pores', desc: 'Shine and pore visibility in your T-zone',          zone: 't_zone'    },
  { key: 'wrinkles', icon: 'wave',                     label: 'Fine lines',  desc: 'Forehead & eye-corner texture',                     zone: 'forehead'  },
  { key: 'tone',     icon: 'palette-outline',          label: 'Even tone',   desc: 'Pigmentation & redness across the skin',            zone: 'cheeks'    },
  { key: 'undereye', icon: 'eye-outline',              label: 'Under-eyes',  desc: 'Dark circles vs cheek brightness',                  zone: 'under_eyes'},
  { key: 'firmness', icon: 'arm-flex-outline',         label: 'Firmness',    desc: 'Skin elasticity along the jawline',                 zone: 'jawline'   },
  { key: 'score',    icon: 'star-four-points-outline', label: 'Glow score',  desc: 'Combining everything into your results',            zone: 'all'       },
];

const TONGUE_FEATURES = [
  { key: 'enhance',   icon: 'auto-fix',                label: 'Enhance',      desc: 'Correcting white balance & contrast',           zone: 'all' },
  { key: 'segment',   icon: 'scissors-cutting',        label: 'Segment',      desc: 'Isolating the tongue from the background',      zone: 'all' },
  { key: 'bodycolor', icon: 'palette',                 label: 'Body colour',  desc: 'Pale, pink, red or purple — maps Qi & Blood',   zone: 'all' },
  { key: 'coating',   icon: 'texture',                 label: 'Coat colour',  desc: 'White, yellow or grey coat — maps Heat/Damp',   zone: 'all' },
  { key: 'thickness', icon: 'layers-outline',          label: 'Coat thick',   desc: 'Thin or thick coat — maps digestive strength',  zone: 'all' },
  { key: 'moisture',  icon: 'water',                   label: 'Moisture',     desc: 'Moist, dry or wet — maps fluid metabolism',     zone: 'all' },
  { key: 'shape',     icon: 'shape-outline',           label: 'Shape',        desc: 'Swollen, thin or cracked — maps organ health',  zone: 'all' },
  { key: 'score',     icon: 'yin-yang',                label: 'Wellness',     desc: 'Overall TCM wellness score',                    zone: 'all' },
];

const PULSE_COLORS = ['#1FA77A', '#7C3AED', '#C850C0'];
const TONGUE_PULSE_COLORS = ['#fa7921', '#C850C0', '#7C3AED'];
const STEP_MS = 480;

function stageCap(stage, status, features) {
  if (status === 'completed') return features.length;
  switch (stage) {
    case 'enhancing': return 1;
    case 'detecting': return 2;
    case 'analyzing': return features.length - 1;
    case 'scoring':   return features.length - 1;
    default:          return 0;
  }
}

const ScanProcessingScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { scanId, scanType, imageUri } = route.params;
  const isTongue = scanType === 'tongue';
  const FEATURES = isTongue ? TONGUE_FEATURES : FACE_FEATURES;
  const pulseColors = isTongue ? TONGUE_PULSE_COLORS : PULSE_COLORS;

  const setLatestScan   = useScanStore(s => s.setLatestScan);
  const setProcessing   = useScanStore(s => s.setProcessing);
  const prependHistory  = useScanStore(s => s.prependHistory);

  const [doneCount, setDoneCount]   = useState(0);
  const [landmarks, setLandmarks]   = useState(null);
  const [aspect, setAspect]         = useState(3 / 4);
  const [box, setBox]               = useState({ w: 0, h: 0 });
  const [selected, setSelected]     = useState(null);
  const [flash, setFlash]           = useState(null);

  const stageRef  = useRef('queued');
  const statusRef = useRef('processing');
  const finalRef  = useRef(null);
  const failedRef = useRef(null);

  // ── Animations ────────────────────────────────────────────────────────────
  const pulse     = useRef(new Animated.Value(0)).current;
  const scan      = useRef(new Animated.Value(0)).current;
  const chipPulse = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const selectClear  = useRef(null);

  useEffect(() => {
    const loop = (val, duration) =>
      Animated.loop(
        Animated.timing(val, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      );
    const a = loop(pulse, 1800);
    const b = Animated.loop(
      Animated.timing(scan, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    const c = Animated.loop(
      Animated.sequence([
        Animated.timing(chipPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(chipPulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    a.start(); b.start(); c.start();
    return () => { a.stop(); b.stop(); c.stop(); };
  }, [pulse, scan, chipPulse]);

  // ── Poll + honest ticker ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    scanService
      .pollScanStatus(scanId, {
        onStatus: payload => {
          if (cancelled) return;
          stageRef.current  = payload.progress_stage || stageRef.current;
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

    const ticker = setInterval(() => {
      if (cancelled) return;
      if (failedRef.current) {
        clearInterval(ticker);
        setProcessing(false);
        navigation.replace('ScanError', { message: failedRef.current, scanType });
        return;
      }
      setDoneCount(prev => {
        const cap  = stageCap(stageRef.current, statusRef.current, FEATURES);
        const next = prev < cap ? prev + 1 : prev;
        if (next >= FEATURES.length && finalRef.current) {
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
          setTimeout(() => {
            if (!cancelled) navigation.replace('ScanResults', { scan: payload, imageUri });
          }, 650);
        }
        return next;
      });
    }, STEP_MS);

    return () => { cancelled = true; clearInterval(ticker); };
  }, [navigation, scanId, scanType, imageUri, setLatestScan, setProcessing, prependHistory, FEATURES]);

  // Flash just-completed feature name
  useEffect(() => {
    if (doneCount <= 0 || doneCount > FEATURES.length) return;
    setFlash(FEATURES[doneCount - 1].label);
    flashOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1300),
      Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [doneCount, flashOpacity, FEATURES]);

  const onTapChip = useCallback((key) => {
    setSelected(key);
    if (selectClear.current) clearTimeout(selectClear.current);
    selectClear.current = setTimeout(() => setSelected(null), 3500);
  }, []);

  useEffect(() => () => { if (selectClear.current) clearTimeout(selectClear.current); }, []);

  const inProgressIndex = Math.min(doneCount, FEATURES.length - 1);
  const activeZone = FEATURES[inProgressIndex]?.zone ?? 'all';
  const finishing  = doneCount >= FEATURES.length;
  const selectedFeature = FEATURES.find(f => f.key === selected);
  const caption = selectedFeature
    ? selectedFeature.desc
    : finishing
    ? 'Finalising your results…'
    : `${FEATURES[inProgressIndex]?.label ?? ''}…`;

  // ── Crop+zoom so the face/tongue fills the card with the mesh aligned ───────
  // The crop box comes from the same landmarks we draw, so the image and the
  // overlay share one coordinate system and stay locked together.
  const crop = React.useMemo(() => computeCrop(landmarks), [landmarks]);
  const cardAspect = crop ? aspect * (crop.w / crop.h) : aspect;
  const stageW    = crop ? box.w / crop.w : box.w;
  const stageH    = crop ? box.h / crop.h : box.h;
  const stageLeft = crop ? -crop.x * stageW : 0;
  const stageTop  = crop ? -crop.y * stageH : 0;

  const scanTranslate = scan.interpolate({ inputRange: [0, 1], outputRange: [0, box.h || 0] });
  const chipScale     = chipPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });

  const headingText = isTongue ? 'Analysing your tongue' : 'Analysing your skin';
  const subText     = isTongue
    ? `Our AI is reading ${FEATURES.length} TCM markers`
    : `Our AI is reading ${FEATURES.length} facial signals`;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

      <Text style={styles.heading}>{headingText}</Text>
      <Text style={styles.subtext}>{subText}</Text>

      {/* Feature icon chips */}
      <View style={styles.chips}>
        {FEATURES.map((f, i) => {
          const done   = i < doneCount;
          const active = i === inProgressIndex && !finishing;
          const isSel  = f.key === selected;
          return (
            <TouchableOpacity key={f.key} activeOpacity={0.8} onPress={() => onTapChip(f.key)} style={styles.chipWrap}>
              <Animated.View
                style={[
                  styles.chip,
                  done && styles.chipDone,
                  active && styles.chipActive,
                  isSel && styles.chipSelected,
                  active && { transform: [{ scale: chipScale }] },
                ]}
              >
                <MCIcon
                  name={done ? 'check' : f.icon}
                  size={18}
                  color={done ? colors.white : active ? colors.primary : colors.textMuted}
                />
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Enlarged, cropped preview: the zoomed "stage" holds the image + mesh in
          one coordinate space (so they stay aligned); pulse/vignette frame the card */}
      <View
        style={[styles.imageCard, { aspectRatio: cardAspect }]}
        onLayout={e => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {box.w > 0 && (
          <View
            style={{ position: 'absolute', width: stageW, height: stageH, left: stageLeft, top: stageTop }}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.imageFallback]}>
                <MCIcon name={isTongue ? 'emoticon-tongue-outline' : 'face-recognition'} size={48} color={colors.primary} />
              </View>
            )}
            <FaceMeshOverlay landmarks={landmarks} activeZone={activeZone} width={stageW} height={stageH} />
          </View>
        )}

        {/* Background scrim — de-emphasises whatever is left around the subject */}
        <CardVignette width={box.w} height={box.h} />

        {!finishing && pulseColors.map((c, i) => {
          const delayed = Animated.add(pulse, new Animated.Value(i / pulseColors.length));
          const mod = delayed.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={c}
              pointerEvents="none"
              style={[
                styles.pulseRing,
                {
                  borderColor: c,
                  opacity: mod.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                  transform: [{ scale: mod.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }],
                },
              ]}
            />
          );
        })}

        {!finishing && box.h > 0 && (
          <Animated.View pointerEvents="none" style={[styles.scanLine, { transform: [{ translateY: scanTranslate }] }]} />
        )}

        <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flashOpacity }]}>
          <MCIcon name="check-circle" size={15} color={colors.white} />
          <Text style={styles.flashText}>{flash}</Text>
        </Animated.View>
      </View>

      <View style={styles.captionRow}>
        {selectedFeature ? (
          <MCIcon name={selectedFeature.icon} size={16} color={colors.primary} />
        ) : (
          <MCIcon name="information-outline" size={16} color={colors.textMuted} />
        )}
        <Text style={[styles.caption, selectedFeature && styles.captionInfo]} numberOfLines={2}>
          {caption}
        </Text>
      </View>

      <Text style={styles.hint}>Tap an icon to learn what we measure</Text>
    </View>
  );
};

export default ScanProcessingScreen;

const makeStyles = colors => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingTop: 60,
    alignItems: 'center',
  },
  heading: { fontSize: 23, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  subtext: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 14 },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  chipWrap: {},
  chip: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  chipActive:   { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  chipDone:     { backgroundColor: colors.primary, borderColor: colors.primary },
  chipSelected: { borderColor: colors.accent },

  // Enlarged image card — full width with slight horizontal inset
  imageCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  imageFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(200,80,192,0.12)' },

  pulseRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 20, borderWidth: 3,
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0, top: 0,
    height: 2.5,
    backgroundColor: 'rgba(200,80,192,0.9)',
    shadowColor: '#C850C0', shadowOpacity: 0.9, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  flash: {
    position: 'absolute', bottom: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(31,167,122,0.92)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  flashText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  captionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, minHeight: 36,
    paddingHorizontal: 12,
  },
  caption:     { fontSize: 14.5, color: colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  captionInfo: { color: colors.textSecondary, fontWeight: '500' },

  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
});
