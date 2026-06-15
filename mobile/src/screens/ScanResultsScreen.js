import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import MetricScoreRow from '../components/scan/MetricScoreRow';
import RecommendationCard from '../components/scan/RecommendationCard';
import { COLORS } from '../constants/theme';

const FACE_METRIC_KEYS = [
  'hydrationScore',
  'oilinessScore',
  'wrinkleScore',
  'pigmentationScore',
  'darkCircleScore',
  'poreScore',
  'elasticityScore',
  'muscleToneScore',
  'inflammationScore',
  'toxinIndicator',
];

function glowColor(score) {
  if (score === null || score === undefined) return '#94a3b8';
  if (score >= 70) return '#22c55e';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

const ScanResultsScreen = ({ navigation, route }) => {
  const { scan } = route.params;
  const results = scan?.results ?? {};
  const recommendations = scan?.recommendations ?? [];
  const glowScore = results.glowScore ?? null;
  const color = glowColor(glowScore);
  const scanType = scan?.scan_type ?? 'face';

  const handleRoutinePress = (routineKey) => {
    Alert.alert('Routine', `Opening ${routineKey} routine…`);
  };

  const isTongue = scanType === 'tongue';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Results</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('FaceGlow')}
          >
            <MCIcon name="home-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Glow Score / Overall */}
        <View style={styles.scoreSection}>
          {!isTongue ? (
            <>
              <View style={[styles.gaugeBorder, { borderColor: color }]}>
                <View style={[styles.gaugeInner, { backgroundColor: `${color}18` }]}>
                  <Text style={[styles.gaugeScore, { color }]}>
                    {glowScore !== null ? Math.round(glowScore) : '--'}
                  </Text>
                  <Text style={styles.gaugeLabel}>Glow Score</Text>
                </View>
              </View>
              <Text style={styles.scoreSubtitle}>
                {glowScore >= 70
                  ? 'Your skin is glowing!'
                  : glowScore >= 45
                  ? 'Good foundation, room to improve'
                  : 'Your skin needs some TLC'}
              </Text>
            </>
          ) : (
            <View style={styles.tongueScoreBox}>
              <MCIcon name="face-recognition" size={40} color="#C850C0" />
              <Text style={styles.tongueTitle}>TCM Tongue Analysis</Text>
              <Text style={styles.tongueSubtitle}>
                Wellness score: {results.overallWellnessScore ?? '--'}
              </Text>
            </View>
          )}
        </View>

        {/* Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isTongue ? 'Tongue Markers' : 'Skin Metrics'}
          </Text>

          {isTongue ? (
            <View style={styles.tongueGrid}>
              {[
                ['Body Colour', results.tongueBodyColor],
                ['Coat Colour', results.tongueCoatColor],
                ['Coat Thickness', results.tongueCoatThick],
                ['Moisture', results.tongueMoisture],
                ['Shape', results.tongueShape],
              ].map(([label, value]) => value ? (
                <View key={label} style={styles.tongueRow}>
                  <Text style={styles.tongueMetaLabel}>{label}</Text>
                  <View style={styles.tongueChip}>
                    <Text style={styles.tongueChipText}>{value}</Text>
                  </View>
                </View>
              ) : null)}
            </View>
          ) : (
            <View style={styles.metricsBox}>
              {FACE_METRIC_KEYS.map(key => (
                <MetricScoreRow key={key} metricKey={key} value={results[key]} />
              ))}
            </View>
          )}
        </View>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {recommendations.map(rec => (
              <RecommendationCard
                key={rec.id}
                item={rec}
                onPressRoutine={handleRoutinePress}
              />
            ))}
          </View>
        )}

        {/* Done button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.navigate('FaceGlow')}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

export default ScanResultsScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: '#C850C0',
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  scoreSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  gaugeBorder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gaugeInner: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: 40,
    fontWeight: '900',
  },
  gaugeLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  tongueScoreBox: {
    alignItems: 'center',
    gap: 8,
  },
  tongueTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  tongueSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },
  metricsBox: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tongueGrid: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tongueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tongueMetaLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tongueChip: {
    backgroundColor: '#fdf4ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tongueChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C850C0',
    textTransform: 'capitalize',
  },
  doneBtn: {
    backgroundColor: '#C850C0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
