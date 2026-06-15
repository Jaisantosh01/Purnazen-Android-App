/**
 * FaceScanScreen — testing stub.
 *
 * Vision Camera (react-native-vision-camera) requires a patch against RN 0.85
 * (currentActivity API change). Until patch-package is applied, this screen
 * uses the system image picker to select a photo from the gallery, which lets
 * us test the full upload → pipeline → results flow without the live camera.
 *
 * To restore live camera:
 *   1. Run:  npx patch-package react-native-vision-camera
 *            (patch the two currentActivity → getCurrentActivity() lines in CameraViewModule.kt)
 *   2. Replace this file with the Vision Camera version from git history.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import { COLORS } from '../constants/theme';
import { ENDPOINTS } from '../constants/apiEndpoints';

// Test image pre-loaded via: adb push face_test_1.jpg /data/local/tmp/test_face.jpg
// then: adb shell run-as com.wellness cp /data/local/tmp/test_face.jpg /data/data/com.wellness/cache/test_face.jpg
const TEST_IMAGE_URI = 'file:///data/data/com.wellness/cache/test_face.jpg';

async function pickImageFromGallery() {
  return new Promise((resolve, reject) => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.85 }, (resp) => {
      if (resp.didCancel) { reject(new Error('cancelled')); return; }
      if (resp.errorCode) { reject(new Error(resp.errorMessage || 'picker error')); return; }
      const asset = resp.assets?.[0];
      if (!asset?.uri) { reject(new Error('no asset')); return; }
      resolve(asset.uri);
    });
  });
}

const grantScanConsent = () =>
  apiClient.post(ENDPOINTS.CONSENT, { consent_type: 'scan_storage', granted: true });

const isConsentError = (msg = '') => msg.toLowerCase().includes('consent');

const FaceScanScreen = ({ navigation, route }) => {
  const scanType = route?.params?.scanType ?? 'face';
  const [uploading, setUploading] = useState(false);

  const setProcessing = useScanStore(s => s.setProcessing);
  const setCurrentScanId = useScanStore(s => s.setCurrentScanId);

  const doUpload = async (uri) => {
    const result = await scanService.uploadScan(uri, scanType);
    setCurrentScanId(result.scan_id);
    setProcessing(true);
    navigation.replace('ScanProcessing', { scanId: result.scan_id, scanType });
  };

  const handlePickAndUpload = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const uri = await pickImageFromGallery();
      try {
        await doUpload(uri);
      } catch (err) {
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

  const label = scanType === 'tongue' ? 'Tongue Scan' : 'Face Scan';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{label}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.placeholderBox}>
          <MCIcon name="camera-outline" size={64} color="#e9d5ff" />
          <Text style={styles.placeholderTitle}>Live Camera</Text>
          <Text style={styles.placeholderSub}>
            Vision Camera requires a patch for RN 0.85.{'\n'}
            Using gallery picker for testing.
          </Text>
        </View>

        <View style={styles.tipBox}>
          <MCIcon name="lightbulb-outline" size={16} color="#C850C0" />
          <Text style={styles.tipText}>
            For best results: good lighting, face centred, minimal shadows.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.btnDisabled]}
          onPress={handlePickAndUpload}
          activeOpacity={0.85}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <MCIcon name="image-plus" size={20} color="#fff" />
              <Text style={styles.uploadBtnText}>
                {scanType === 'tongue' ? 'Select Tongue Photo' : 'Select Face Photo'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testBtn, uploading && styles.btnDisabled]}
          onPress={handleTestImage}
          activeOpacity={0.85}
          disabled={uploading}
        >
          <MCIcon name="test-tube" size={18} color="#C850C0" />
          <Text style={styles.testBtnText}>Use Test Image (Dev)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default FaceScanScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
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
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 24,
  },
  placeholderBox: {
    width: '100%',
    backgroundColor: '#fdf4ff',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#e9d5ff',
    borderStyle: 'dashed',
  },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: '#C850C0' },
  placeholderSub: {
    fontSize: 13, color: COLORS.textMuted,
    textAlign: 'center', lineHeight: 19,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#C850C0',
    width: '100%',
  },
  tipText: { flex: 1, fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#C850C0',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  uploadBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#C850C0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    justifyContent: 'center',
    backgroundColor: '#fdf4ff',
  },
  testBtnText: { color: '#C850C0', fontSize: 14, fontWeight: '600' },
});
