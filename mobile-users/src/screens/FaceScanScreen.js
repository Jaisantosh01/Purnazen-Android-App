import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import { COLORS } from '../constants/theme';
import { ENDPOINTS } from '../constants/apiEndpoints';
import FaceOverlayGuide from '../components/scan/FaceOverlayGuide';

const QUALITY_CHECK_INTERVAL_MS = 2200;

// Dev: test image pre-loaded via:
//   adb push face_test_1.jpg /data/local/tmp/test_face.jpg
//   adb shell run-as com.purnazen cp /data/local/tmp/test_face.jpg /data/data/com.purnazen/cache/test_face.jpg
const TEST_IMAGE_URI = 'file:///data/data/com.purnazen/cache/test_face.jpg';

const grantScanConsent = () =>
  apiClient.post(ENDPOINTS.CONSENT, { consent_type: 'scan_storage', granted: true });

const isConsentError = (msg = '') => msg.toLowerCase().includes('consent');

// ── Live quality guidance ─────────────────────────────────────────────────────
// Oval-centric, action-first copy. Drives the oval colour + the instruction pill.
const FACE_GUIDANCE = {
  no_face:        'Bring your face into the oval',
  multiple_faces: 'Only one face in the oval, please',
  face_too_small: 'Move a little closer',
  off_center:     'Align your face inside the oval',
  too_dark:       'Find brighter, even lighting',
  too_bright:     'Too bright — avoid glare or backlight',
  too_blurry:     'Hold still — keep your face sharp',
};

function deriveQuality(issues) {
  if (issues === null) return { status: 'checking', message: 'Detecting your face…' };
  if (issues.length === 0) return { status: 'ready', message: 'Perfect — hold still & tap to capture' };
  const blocking = issues.filter(i => i.blocking);
  const top = blocking[0] || issues[0];
  return {
    status: 'warn',
    message: FACE_GUIDANCE[top.code] || top.guidance || 'Align your face in the oval',
  };
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const FaceScanScreen = ({ navigation, route }) => {
  const scanType = route?.params?.scanType ?? 'face';

  const cameraRef = useRef(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [uploading, setUploading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [headerH, setHeaderH] = useState(106);
  const [qualityIssues, setQualityIssues] = useState(null); // null=initial, []= ok, [...]= issues

  const setProcessing = useScanStore(s => s.setProcessing);
  const setCurrentScanId = useScanStore(s => s.setCurrentScanId);

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
        const result = await scanService.qualityPreview(`file://${photo.path}`, 'face');
        if (!cancelled) setQualityIssues(result?.issues ?? []);
      } catch {
        // Don't claim "ready" on a failed check — leave the last known state
        // (or "checking" if we never got a reading). The server gate is the
        // real guard at upload time.
      } finally {
        running = false;
      }
    };

    const interval = setInterval(runCheck, QUALITY_CHECK_INTERVAL_MS);
    const warmup  = setTimeout(runCheck, 1400);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(warmup);
    };
  }, [hasPermission, device, uploading, capturing]);

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
        Alert.alert("Let's retake that", err.guidance, [{ text: 'Got it' }]);
        return;
      }
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      if (isConsentError(msg)) {
        Alert.alert(
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
                  Alert.alert('Error', e2?.response?.data?.message || e2?.message || 'Upload failed');
                } finally {
                  setUploading(false);
                }
              },
            },
          ],
        );
      } else {
        Alert.alert('Error', msg);
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
      Alert.alert('Error', err?.message || 'Failed to capture photo');
    } finally {
      setUploading(false);
    }
  };

  const handleGallery = async () => {
    if (uploading) return;
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
      if (err?.message !== 'cancelled') Alert.alert('Error', err?.message || 'Failed to pick image');
    } finally {
      setUploading(false);
    }
  };

  const handleTestImage = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      try { await grantScanConsent(); } catch {}
      await doUpload(TEST_IMAGE_URI);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Permission denied ────────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#C850C0" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Face Scan</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.permissionBody}>
          <MCIcon name="camera-off" size={64} color="#e9d5ff" />
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permSub}>
            Purnazen needs camera access to scan your face and provide personalised wellness insights.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permBtnOutline} onPress={() => Linking.openSettings()}>
            <Text style={styles.permBtnOutlineText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.permBtnOutline, { marginTop: 4 }]} onPress={handleGallery}>
            <MCIcon name="image-multiple" size={16} color="#C850C0" />
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
        <StatusBar barStyle="light-content" backgroundColor="#C850C0" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Face Scan</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.permissionBody}>
          <MCIcon name="camera-outline" size={64} color="#e9d5ff" />
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

      <FaceOverlayGuide
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
            <ActivityIndicator color="#C850C0" size="large" />
          ) : (
            <View style={[styles.captureInner, ready && styles.captureInnerReady]} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideBtn}
          onPress={handleTestImage}
          disabled={uploading || capturing}
          activeOpacity={0.7}
        >
          <MCIcon name="test-tube" size={26} color="#fff" />
          <Text style={styles.sideBtnLabel}>Test</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FaceScanScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: {
    backgroundColor: '#C850C0',
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
    backgroundColor: COLORS.background,
  },
  permTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  permSub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 21 },
  permBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#C850C0', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 32,
    alignSelf: 'stretch', justifyContent: 'center',
  },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  permBtnOutline: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#C850C0',
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24,
    alignSelf: 'stretch', justifyContent: 'center',
    backgroundColor: '#fdf4ff',
  },
  permBtnOutlineText: { color: '#C850C0', fontSize: 14, fontWeight: '600' },
});
