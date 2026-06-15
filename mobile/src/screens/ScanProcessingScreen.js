import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import { COLORS } from '../constants/theme';

const STEPS = [
  'Uploading image...',
  'Detecting face landmarks...',
  'Analysing skin metrics...',
  'Generating recommendations...',
];

const ScanProcessingScreen = ({ navigation, route }) => {
  const { scanId, scanType } = route.params;
  const setLatestScan = useScanStore(s => s.setLatestScan);
  const setProcessing = useScanStore(s => s.setProcessing);
  const prependHistory = useScanStore(s => s.prependHistory);

  const spinValue = useRef(new Animated.Value(0)).current;
  const stepIndex = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spin animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    // Step label animation — cycle through steps every ~3s
    let step = 0;
    const stepTimer = setInterval(() => {
      step = (step + 1) % STEPS.length;
      stepIndex.setValue(step);
    }, 3000);

    let cancelled = false;

    scanService
      .pollScanStatus(scanId, {
        onStatus: () => {},
      })
      .then(payload => {
        if (cancelled) return;
        setLatestScan(payload);
        setProcessing(false);
        if (payload.status === 'completed') {
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
        } else {
          navigation.replace('ScanError', {
            message: payload.error_message || 'Scan analysis failed. Please try again.',
            scanType,
          });
        }
      })
      .catch(err => {
        if (cancelled) return;
        setProcessing(false);
        navigation.replace('ScanError', {
          message: err?.message || 'Scan timed out. Please try again.',
          scanType,
        });
      });

    return () => {
      cancelled = true;
      clearInterval(stepTimer);
    };
  }, [navigation, scanId, scanType, setLatestScan, setProcessing, prependHistory, spinValue, stepIndex]);

  const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />

      <View style={styles.content}>
        <View style={styles.spinnerBox}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MCIcon name="loading" size={52} color="#C850C0" />
          </Animated.View>
          <View style={styles.iconOverlay}>
            <MCIcon
              name={scanType === 'tongue' ? 'face-recognition' : 'face-woman-shimmer-outline'}
              size={24}
              color={COLORS.textMuted}
            />
          </View>
        </View>

        <Text style={styles.heading}>Analysing your scan…</Text>
        <Text style={styles.subtext}>This takes about 10 seconds</Text>

        <View style={styles.stepsBox}>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <MCIcon
                name="check-circle-outline"
                size={16}
                color="#C850C0"
              />
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export default ScanProcessingScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  spinnerBox: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconOverlay: {
    position: 'absolute',
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
  },
  stepsBox: {
    marginTop: 24,
    gap: 10,
    alignSelf: 'stretch',
    backgroundColor: '#fdf4ff',
    borderRadius: 16,
    padding: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
