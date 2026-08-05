import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

const FACE_TIPS = [
  'Ensure good, even lighting on your face',
  'Hold the camera steady at arm\'s length',
  'Make sure your face fills most of the frame',
  'Avoid strong backlighting or shadows',
];

const TONGUE_TIPS = [
  'Open wide and stick your tongue out fully',
  'Use bright, even light — avoid chin shadows',
  'Centre your tongue inside the oval guide',
  'Hold still for a sharp, clear photo',
];

const ScanErrorScreen = ({ navigation, route }) => {
  const { message = 'Scan analysis failed. Please try again.', scanType = 'face' } =
    route?.params ?? {};
  const isTongue = scanType === 'tongue';
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tips = isTongue ? TONGUE_TIPS : FACE_TIPS;

  const handleRetry = () => {
    // Face and tongue each have their own camera screen — never send a failed
    // tongue scan back into FaceScan (its auto-capture would re-upload a face
    // photo as tongue and fail in a loop).
    if (isTongue) {
      navigation.replace('TongueScan');
    } else {
      navigation.replace('FaceScan', { scanType: 'face' });
    }
  };

  const handleGoHome = () => {
    navigation.popToTop();
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.content}>
        <View style={styles.iconBox}>
          <MCIcon name="alert-circle-outline" size={72} color="#f87171" />
        </View>

        <Text style={styles.title}>Scan Failed</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Tips for a successful scan:</Text>
          {tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <MCIcon name="check-circle" size={14} color={isTongue ? '#fa7921' : '#C850C0'} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.retryBtn, isTongue && styles.retryBtnTongue]}
          onPress={handleRetry}
          activeOpacity={0.85}
        >
          <MCIcon name="camera-retake-outline" size={20} color="#fff" />
          <Text style={styles.retryBtnText}>Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome} activeOpacity={0.7}>
          <Text style={styles.homeBtnText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ScanErrorScreen;

const makeStyles = colors => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconBox: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(248,113,113,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  tips: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(200,80,192,0.12)',
    borderRadius: 16,
    padding: 18,
    gap: 10,
    marginTop: 8,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  tipText: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C850C0',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  retryBtnTongue: {
    backgroundColor: '#fa7921',
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  homeBtn: {
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  homeBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
