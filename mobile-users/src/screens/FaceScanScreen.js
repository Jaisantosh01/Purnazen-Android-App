import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../utils/alert';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import scanService from '../services/scanService';
import consentService from '../services/consentService';
import { checkCaptureQuality, hasOnDeviceQuality } from '../services/scanQualityService';
import useScanStore from '../store/scanStore';
import useTheme from '../hooks/useTheme';
import { ENDPOINTS } from '../constants/apiEndpoints';
import FaceOverlayGuide from '../components/scan/FaceOverlayGuide';

// On-device checks are near-instant, so we can run them at a smooth cadence.
// The server fallback keeps the old conservative interval (network-bound).
const QUALITY_INTERVAL_DEVICE_MS = 900;
const QUALITY_INTERVAL_SERVER_MS = 2200;

// Consecutive "ready" readings required before the auto-capture countdown starts.
const AUTO_CAPTURE_READY_STREAK = 2;
const AUTO_CAPTURE_COUNTDOWN_START = 3;

// Trailing slash matches the FastAPI route ("/consent/"). Without it the
// no-slash request hits a 307 redirect that downgrades https→http behind the
// Container Apps proxy, which fails on-device (network error) and never saves
// the consent — so the prompt would reappear on every scan.
const grantScanConsent = () =>
  apiClient.post(`${ENDPOINTS.CONSENT}/`, { consent_type: 'scan_storage', granted: true });

const isConsentError = (msg = '') => msg.toLowerCase().includes('consent');

// ── Live quality guidance ─────────────────────────────────────────────────────
// Oval-centric, action-first copy. Drives the oval colour + the instruction pill.
const FACE_GUIDANCE = {
  no_face:        'Bring your face into the oval',
  multiple_faces: 'Only one face in the oval, please',
  face_too_small: 'Move a little closer',
  off_center:     'Align your face inside the oval',
  not_frontal:    'Look straight at the camera',
  too_dark:       'Find brighter, even lighting',
  too_bright:     'Too bright — avoid glare or backlight',
  too_blurry:     'Hold still — keep your face sharp',
};

function deriveQuality(issues) {
  if (issues === null) return { status: 'checking', message: 'Detecting your face…' };
  if (issues.length === 0) return { status: 'ready', message: 'Perfect — hold this position' };
  const blocking = issues.filter(i => i.blocking);
  const top = blocking[0] || issues[0];
  return {
    status: 'warn',
    message: FACE_GUIDANCE[top.code] || top.guidance || 'Align your face in the oval',
  };
}

// Per-aspect pass/fail for the overlay chips (Lighting / Position / Clarity).
function deriveChecks(issues) {
  if (issues === null) return null;
  const has = c => issues.some(i => i.code === c);
  return {
    lighting: !has('too_dark') && !has('too_bright'),
    position:
      !has('no_face') && !has('multiple_faces') && !has('face_too_small') &&
      !has('off_center') && !has('not_frontal'),
    clarity: !has('too_blurry'),
  };
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const FaceScanScreen = ({ navigation }) => {
  // FaceScan is face-only. Tongue uses TongueScanScreen — never honour a
  // scanType:'tongue' param here (a past ScanError "Try Again" bug routed
  // tongue failures into this screen and auto-capture re-failed in a loop).
  const scanType = 'face';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, insets), [colors, insets]);

  const cameraRef = useRef(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Prefer the sensor's full photo resolution — the default format can pick a
  // low-res stream, which is why in-app captures looked worse than the system
  // camera app.
  const format = useCameraFormat(device, [
    { photoResolution: 'max' },
    { videoResolution: 'max' },
  ]);

  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [headerH, setHeaderH] = useState(106);
  const [qualityIssues, setQualityIssues] = useState(null); // null=initial, []= ok, [...]= issues
  const [autoCapture, setAutoCapture] = useState(true);
  const [countdown, setCountdown] = useState(null); // null=off, 3..1 while counting
  const [scanConsent, setScanConsent] = useState(null); // null=unknown, bool=resolved
  const consentPrompted = useRef(false);

  const readyStreak = useRef(0);
  const onDeviceChecks = scanType === 'face' && hasOnDeviceQuality;

  const setProcessing = useScanStore(s => s.setProcessing);
  const setCurrentScanId = useScanStore(s => s.setCurrentScanId);

  // Show the scan-storage consent dialog; resolves true once granted (and
  // persisted — so the Consent settings screen reflects it), false if declined.
  const requestScanConsent = () => new Promise(resolve => {
    showAlert(
      'Allow scan storage?',
      'To run a scan, Purnazen needs your consent to securely store your scan photo and results so you can track progress over time. You can withdraw this anytime in Settings › Privacy & Data.',
      [
        { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Allow & Continue',
          onPress: async () => {
            try {
              await grantScanConsent();
              setScanConsent(true);
              resolve(true);
            } catch (e) {
              showAlert('Error', e?.response?.data?.message || e?.message || 'Could not save your consent.');
              resolve(false);
            }
          },
        },
      ],
      { cancelable: false },
    );
  });

  // Gate before any capture/upload: allow immediately when already consented,
  // otherwise resolve the stored state and prompt if still missing.
  const ensureScanConsent = async () => {
    if (scanConsent === true) return true;
    if (scanConsent === null) {
      try {
        const ok = await consentService.hasConsent('scan_storage');
        setScanConsent(ok);
        if (ok) return true;
      } catch { /* fall through to prompt */ }
    }
    return requestScanConsent();
  };

  useEffect(() => {
    if (!hasPermission) requestPermission();
    return () => setCameraActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the stored scan-storage consent once, up front.
  useEffect(() => {
    let alive = true;
    consentService.hasConsent('scan_storage')
      .then(ok => { if (alive) setScanConsent(ok); })
      .catch(() => { if (alive) setScanConsent(false); });
    return () => { alive = false; };
  }, []);

  // Ask the moment the camera opens without consent (declining just leaves
  // capture gated — the shutter re-asks).
  useEffect(() => {
    if (hasPermission && scanConsent === false && !consentPrompted.current) {
      consentPrompted.current = true;
      requestScanConsent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, scanConsent]);

  // Periodic live quality check on a silent low-res snapshot. With the native
  // module the frame is analysed on-device (fast, offline, private); otherwise
  // it falls back to the server preview endpoint.
  useEffect(() => {
    if (!hasPermission || !device) return;

    let cancelled = false;
    let running = false;

    const runCheck = async () => {
      if (running || cancelled || !cameraRef.current || uploading || capturing) return;
      running = true;
      try {
        const photo = await cameraRef.current.takeSnapshot({ quality: 50 });
        if (cancelled) return;
        const result = await checkCaptureQuality(`file://${photo.path}`, scanType);
        if (!cancelled) setQualityIssues(result?.issues ?? []);
      } catch {
        // Don't claim "ready" on a failed check — leave the last known state
        // (or "checking" if we never got a reading). The server gate is the
        // real guard at upload time.
      } finally {
        running = false;
      }
    };

    const intervalMs = onDeviceChecks ? QUALITY_INTERVAL_DEVICE_MS : QUALITY_INTERVAL_SERVER_MS;
    const interval = setInterval(runCheck, intervalMs);
    const warmup = setTimeout(runCheck, 600);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(warmup);
    };
  }, [hasPermission, device, uploading, capturing, scanType, onDeviceChecks]);

  const doUpload = async (uri) => {
    const result = await scanService.uploadScan(uri, scanType);
    setCurrentScanId(result.scan_id);
    setProcessing(true);
    navigation.replace('ScanProcessing', { scanId: result.scan_id, scanType, imageUri: uri });
  };

  const uploadWithConsentRetry = async (uri) => {
    try {
      await doUpload(uri);
    } catch (err) {
      if (err?.guidance) {
        showAlert("Let's retake that", err.guidance, [{ text: 'Got it' }]);
        return;
      }
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      if (isConsentError(msg)) {
        showAlert(
          'Storage Permission',
          'Allow Purnazen to store your scan results securely?',
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Allow',
              onPress: async () => {
                setUploading(true);
                try {
                  await grantScanConsent();
                  await doUpload(uri);
                } catch (e2) {
                  showAlert('Error', e2?.response?.data?.message || e2?.message || 'Upload failed');
                } finally {
                  setUploading(false);
                }
              },
            },
          ],
        );
      } else {
        showAlert('Error', msg);
      }
    }
  };

  const handleCapture = useCallback(async () => {
    if (capturing || uploading || !cameraRef.current) return;
    // No storage consent → ask (or re-ask) before we ever take the photo.
    if (!(await ensureScanConsent())) return;
    // Gate the manual shutter the same way auto-capture is gated: don't shoot
    // while a blocking quality issue is active (no/partial face, off-centre,
    // too small…), so a half-in-frame face can't be captured and processed.
    const blocking = Array.isArray(qualityIssues) ? qualityIssues.filter(i => i.blocking) : [];
    if (blocking.length) {
      showAlert(
        'Almost there',
        FACE_GUIDANCE[blocking[0].code] || blocking[0].guidance || 'Align your face inside the oval',
        [{ text: 'Got it' }],
      );
      return;
    }
    setCountdown(null);
    readyStreak.current = 0;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      const uri = `file://${photo.path}`;
      setCapturing(false);
      setUploading(true);
      await uploadWithConsentRetry(uri);
    } catch (err) {
      setCapturing(false);
      showAlert('Error', err?.message || 'Failed to capture photo');
    } finally {
      setUploading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, uploading, qualityIssues]);

  const quality = deriveQuality(qualityIssues);
  const ready = quality.status === 'ready';

  // ── Auto-capture: after a stable "ready" streak, count down and shoot ───────
  useEffect(() => {
    if (!autoCapture || uploading || capturing) return;
    if (ready) {
      readyStreak.current += 1;
      if (readyStreak.current >= AUTO_CAPTURE_READY_STREAK && countdown == null) {
        setCountdown(AUTO_CAPTURE_COUNTDOWN_START);
      }
    } else {
      readyStreak.current = 0;
      if (countdown != null) setCountdown(null); // quality dropped — abort
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qualityIssues, autoCapture, uploading, capturing]);

  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 0) {
      handleCapture();
      return;
    }
    const t = setTimeout(() => {
      setCountdown(c => (c == null ? null : c - 1));
    }, 900);
    return () => clearTimeout(t);
  }, [countdown, handleCapture]);

  const toggleAutoCapture = () => {
    setAutoCapture(v => {
      if (v) setCountdown(null);
      readyStreak.current = 0;
      return !v;
    });
  };

  // Once the user has denied the permission, Android stops showing the request
  // dialog and requestPermission() resolves false immediately — so a bare
  // requestPermission onPress looks like a dead button. Fall through to the
  // system settings in that case (hasPermission refreshes on app resume).
  const handleGrantPermission = async () => {
    const granted = await requestPermission();
    if (!granted) {
      showAlert(
        'Permission Needed',
        'Android is no longer showing the camera dialog because access was denied earlier. Please enable Camera for Purnazen in Settings.',
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleGallery = async () => {
    if (uploading) return;
    if (!(await ensureScanConsent())) return;
    setCountdown(null);
    setUploading(true);
    let uri = null;
    try {
      uri = await new Promise((resolve, reject) => {
        launchImageLibrary({ mediaType: 'photo', quality: 0.85 }, (resp) => {
          if (resp.didCancel) { reject(new Error('cancelled')); return; }
          if (resp.errorCode) { reject(new Error(resp.errorMessage || 'picker error')); return; }
          const asset = resp.assets?.[0];
          if (!asset?.uri) { reject(new Error('no asset')); return; }
          resolve(asset.uri);
        });
      });
      await uploadWithConsentRetry(uri);
    } catch (err) {
      if (err?.message !== 'cancelled') showAlert('Error', err?.message || 'Failed to pick image');
    } finally {
      setUploading(false);
    }
  };

  // ── Permission denied ────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.rootThemed}>
        <StatusBar barStyle="light-content" backgroundColor={ACCENT} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Face Scan</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.permissionBody}>
          <MCIcon name="camera-off" size={64} color={`${ACCENT}66`} />
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permSub}>
            Purnazen needs camera access to scan your face and provide personalised wellness insights.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={handleGrantPermission}>
            <Text style={styles.permBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.permBtnOutline, { marginTop: 4 }]} onPress={handleGallery}>
            <MCIcon name="image-multiple" size={16} color={ACCENT} />
            <Text style={[styles.permBtnOutlineText, { marginLeft: 6 }]}>Use Gallery Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── No front camera ──────────────────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.rootThemed}>
        <StatusBar barStyle="light-content" backgroundColor={ACCENT} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Face Scan</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.permissionBody}>
          <MCIcon name="camera-outline" size={64} color={`${ACCENT}66`} />
          <Text style={styles.permTitle}>No Front Camera Found</Text>
          <TouchableOpacity style={styles.permBtn} onPress={handleGallery}>
            <MCIcon name="image-plus" size={18} color="#fff" />
            <Text style={[styles.permBtnText, { marginLeft: 8 }]}>Select from Gallery</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Camera view ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive={cameraActive && !uploading}
        photo
        photoQualityBalance="quality"
        photoHdr={format?.supportsPhotoHdr}
      />

      <FaceOverlayGuide
        instruction={quality.message}
        status={quality.status}
        headerHeight={headerH}
        bottomBarHeight={140}
        countdown={countdown}
        checks={deriveChecks(qualityIssues)}
        onDevice={onDeviceChecks}
      />

      {/* Header */}
      <View
        style={styles.cameraHeader}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Scan</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={handleGallery}
          disabled={uploading || capturing}
          activeOpacity={0.7}
        >
          <MCIcon name="image-multiple-outline" size={26} color="#fff" />
          <Text style={styles.sideBtnLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.captureBtn,
            ready && styles.captureBtnReady,
            (uploading || capturing) && styles.captureBtnDisabled,
          ]}
          onPress={handleCapture}
          disabled={uploading || capturing}
          activeOpacity={0.85}
        >
          {(uploading || capturing) ? (
            <ActivityIndicator color={ACCENT} size="large" />
          ) : (
            <View style={[styles.captureInner, ready && styles.captureInnerReady]} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideBtn}
          onPress={toggleAutoCapture}
          disabled={uploading || capturing}
          activeOpacity={0.7}
        >
          <MCIcon
            name={autoCapture ? 'timer-outline' : 'timer-off-outline'}
            size={26}
            color={autoCapture ? '#4ade80' : 'rgba(255,255,255,0.6)'}
          />
          <Text style={[styles.sideBtnLabel, autoCapture && { color: '#bbf7d0' }]}>
            {autoCapture ? 'Auto on' : 'Auto off'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FaceScanScreen;

const ACCENT = '#C850C0';

const makeStyles = (colors, insets) => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  rootThemed: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: ACCENT,
    paddingTop: Math.max(insets.top, 12) + 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  cameraHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: Math.max(insets.top, 12) + 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 140,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  captureBtn: {
    width: 76, height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnReady: { borderColor: '#22c55e' },
  captureBtnDisabled: { opacity: 0.5 },
  captureInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#fff',
  },
  captureInnerReady: { backgroundColor: '#22c55e' },
  sideBtn: {
    alignItems: 'center', gap: 4, minWidth: 56,
  },
  sideBtnLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
  },

  permissionBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 16,
    backgroundColor: colors.background,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  permSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: ACCENT, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 32,
    alignSelf: 'stretch', justifyContent: 'center',
  },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  permBtnOutline: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: ACCENT,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24,
    alignSelf: 'stretch', justifyContent: 'center',
    backgroundColor: ACCENT + '14',
  },
  permBtnOutlineText: { color: ACCENT, fontSize: 14, fontWeight: '600' },
});
