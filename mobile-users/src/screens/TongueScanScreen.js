import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { showAlert } from '../utils/alert';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import useTheme from '../hooks/useTheme';
import { ENDPOINTS } from '../constants/apiEndpoints';
import TongueOverlayGuide from '../components/scan/TongueOverlayGuide';

const QUALITY_CHECK_INTERVAL_MS = 2500;

const TIPS = [
  'Open your mouth wide and stick tongue out fully',
  'Use bright, even light — avoid shadows under your chin',
  'Hold still for a sharp, clear photo',
  'No food or drink 30 min before scanning',
];

// Trailing slash matches the FastAPI route ("/consent/"); without it the
// no-slash request 307-redirects https→http behind the Container Apps proxy,
// which fails on-device and never persists the consent.
const grantScanConsent = () =>
  apiClient.post(`${ENDPOINTS.CONSENT}/`, { consent_type: 'scan_storage', granted: true });

const isConsentError = (msg = '') => msg.toLowerCase().includes('consent');

// Live quality guidance — oval-centric, action-first copy.
const TONGUE_GUIDANCE = {
  no_tongue:  'Stick your tongue out in the oval',
  too_dark:   'Find brighter, even lighting',
  too_bright: 'Too bright — reduce glare',
  too_blurry: 'Hold still — keep it sharp',
};

function deriveQuality(issues) {
  if (issues === null) return { status: 'checking', message: 'Open wide & stick your tongue out' };
  if (issues.length === 0) return { status: 'ready', message: 'Perfect — hold still & tap to capture' };
  const blocking = issues.filter(i => i.blocking);
  const top = blocking[0] || issues[0];
  return {
    status: 'warn',
    message: TONGUE_GUIDANCE[top.code] || top.guidance || 'Centre your tongue in the oval',
  };
}

const TongueScanScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cameraRef = useRef(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [headerH, setHeaderH] = useState(106);
  const [tipIndex, setTipIndex] = useState(0);
  const [qualityIssues, setQualityIssues] = useState(null); // null = checking, [] = ok, [...] = issues

  const setProcessing = useScanStore(s => s.setProcessing);
  const setCurrentScanId = useScanStore(s => s.setCurrentScanId);

  // Cycle tips every 4s
  useEffect(() => {
    const t = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!hasPermission) requestPermission();
    return () => setCameraActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic live quality check using silent snapshot
  useEffect(() => {
    if (!hasPermission || !device) return;

    let cancelled = false;
    let running = false;

    const runCheck = async () => {
      if (running || cancelled || !cameraRef.current || uploading || capturing) return;
      running = true;
      try {
        const photo = await cameraRef.current.takeSnapshot({ quality: 40 });
        if (cancelled) return;
        const result = await scanService.qualityPreview(`file://${photo.path}`, 'tongue');
        if (!cancelled) setQualityIssues(result?.issues ?? []);
      } catch {
        // Snapshot or network failed — keep the last known state rather than
        // falsely claiming "ready". The server gate validates at upload time.
      } finally {
        running = false;
      }
    };

    const interval = setInterval(runCheck, QUALITY_CHECK_INTERVAL_MS);
    // Run once immediately after a short delay (let camera warm up)
    const warmup = setTimeout(runCheck, 1200);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(warmup);
    };
  }, [hasPermission, device, uploading, capturing]);

  const doUpload = async (uri) => {
    const result = await scanService.uploadScan(uri, 'tongue');
    setCurrentScanId(result.scan_id);
    setProcessing(true);
    navigation.replace('ScanProcessing', { scanId: result.scan_id, scanType: 'tongue', imageUri: uri });
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

  const handleCapture = async () => {
    if (capturing || uploading || !cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
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
  };

  const handleGallery = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const uri = await new Promise((resolve, reject) => {
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
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#fa7921" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tongue Scan</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.permissionBody}>
          <MCIcon name="camera-off" size={64} color="#ffedd5" />
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permSub}>
            Purnazen needs camera access to scan your tongue for TCM wellness insights.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permBtnOutline} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnOutlineText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.permBtnOutline, { marginTop: 4 }]} onPress={handleGallery}>
            <MCIcon name="image-multiple" size={16} color="#fa7921" />
            <Text style={[styles.permBtnOutlineText, { marginLeft: 6 }]}>Use Gallery Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── No front camera ──────────────────────────────────────────────────────────
  if (!device) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#fa7921" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tongue Scan</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.permissionBody}>
          <MCIcon name="camera-outline" size={64} color="#ffedd5" />
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
  const quality = deriveQuality(qualityIssues);
  const ready = quality.status === 'ready';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={cameraActive && !uploading}
        photo
        photoQualityBalance="balanced"
      />

      <TongueOverlayGuide
        instruction={quality.message}
        status={quality.status}
        headerHeight={headerH}
        bottomBarHeight={140}
      />

      {/* Header */}
      <View
        style={styles.cameraHeader}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <MCIcon name="emoticon-tongue-outline" size={18} color="#fff" />
          <Text style={styles.headerTitle}> Tongue Scan</Text>
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Cycling tip */}
      <View style={styles.tipRow}>
        <MCIcon name="information-outline" size={13} color="rgba(255,255,255,0.72)" />
        <Text style={styles.tipText}>{TIPS[tipIndex]}</Text>
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
            <ActivityIndicator color="#fa7921" size="large" />
          ) : (
            <View style={[styles.captureInner, ready && styles.captureInnerReady]} />
          )}
        </TouchableOpacity>

        {/* TCM info button */}
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() => showAlert(
            'TCM Tongue Diagnosis',
            'Traditional Chinese Medicine uses tongue colour, coating and moisture as diagnostic markers for organ system health and Qi balance.',
            [{ text: 'Got it' }],
          )}
          activeOpacity={0.7}
        >
          <MCIcon name="yin-yang" size={26} color="#fff" />
          <Text style={styles.sideBtnLabel}>What is this?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TongueScanScreen;

const ACCENT = '#fa7921';

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    backgroundColor: ACCENT,
    paddingTop: 52,
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
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  // Quality hint

  // Tip row above bottom bar
  tipRow: {
    position: 'absolute',
    bottom: 148,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tipText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },

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
    alignItems: 'center', gap: 4, minWidth: 60,
  },
  sideBtnLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Permission / no-camera screens
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
    backgroundColor: '#fff8f5',
  },
  permBtnOutlineText: { color: ACCENT, fontSize: 14, fontWeight: '600' },
});
