import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Share,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import MetricScoreRow from '../components/scan/MetricScoreRow';
import RecommendationCard from '../components/scan/RecommendationCard';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

const METRIC_LABELS = {
  hydrationScore: 'Hydration',
  oilinessScore: 'Oiliness',
  wrinkleScore: 'Fine lines',
  pigmentationScore: 'Pigmentation',
  darkCircleScore: 'Dark circles',
  poreScore: 'Pores',
  elasticityScore: 'Elasticity',
  inflammationScore: 'Inflammation',
  toxinIndicator: 'Toxin indicator',
};

const TONGUE_SHARE_ROWS = [
  ['Tongue colour', 'tongueBodyColor'],
  ['Coat colour', 'tongueCoatColor'],
  ['Coat thickness', 'tongueCoatThick'],
  ['Moisture', 'tongueMoisture'],
  ['Shape', 'tongueShape'],
];

function buildShareText(results, glowScore, recommendations, isTongue) {
  // Tongue and skin scans are distinct reports — share the matching one.
  if (isTongue) {
    const lines = ['My Purnazen TCM tongue analysis', ''];
    if (results.overallWellnessScore != null) lines.push(`Wellness score: ${Math.round(results.overallWellnessScore)}/100`);
    const markers = TONGUE_SHARE_ROWS.filter(([, key]) => results[key] != null);
    if (markers.length) {
      lines.push('', 'Tongue markers:');
      markers.forEach(([label, key]) => lines.push(`• ${label}: ${results[key]}`));
    }
    if (recommendations.length) {
      lines.push('', 'Top tips:');
      recommendations.slice(0, 3).forEach(r => lines.push(`• ${r.title}`));
    }
    lines.push('', 'Analyzed with Purnazen.');
    return lines.join('\n');
  }

  const lines = ['My Purnazen skin analysis', ''];
  if (glowScore != null) lines.push(`Glow Score: ${Math.round(glowScore)}/100`);
  if (results.overallWellnessScore != null) lines.push(`Wellness: ${Math.round(results.overallWellnessScore)}/100`);
  if (results.skinAgeEstimate != null) lines.push(`Skin age estimate: ${results.skinAgeEstimate}`);
  lines.push('', 'Metrics:');
  Object.keys(METRIC_LABELS).forEach(k => {
    if (results[k] != null) lines.push(`• ${METRIC_LABELS[k]}: ${Math.round(results[k])}`);
  });
  if (recommendations.length) {
    lines.push('', 'Top tips:');
    recommendations.slice(0, 3).forEach(r => lines.push(`• ${r.title}`));
  }
  lines.push('', 'Analyzed with Purnazen.');
  return lines.join('\n');
}

const FACE_METRIC_KEYS = [
  'hydrationScore',
  'oilinessScore',
  'wrinkleScore',
  'pigmentationScore',
  'darkCircleScore',
  'poreScore',
  'elasticityScore',
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
  const headerTop = useHeaderTopPadding();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { scan, imageUri } = route.params;
  const results = scan?.results ?? {};
  const recommendations = scan?.recommendations ?? [];
  const glowScore = results.glowScore ?? null;
  const color = glowColor(glowScore);
  const scanType = scan?.scan_type ?? 'face';

  // Enhanced (server) vs original (local capture) preview.
  // Default to the locally-captured image — it always loads instantly. The
  // server-enhanced URL can fail to load (e.g. dev host unreachable); if it does
  // we fall back to the original via onError instead of showing a black frame.
  const enhancedUri = scan?.processed_image_url ?? null;
  const originalUri = imageUri ?? scan?.image_url ?? null;
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [enhancedFailed, setEnhancedFailed] = useState(false);
  const canShowEnhanced = !!enhancedUri && !enhancedFailed;
  const shownUri = showEnhanced && canShowEnhanced ? enhancedUri : originalUri;

  const handleRoutinePress = (routineKey) => {
    showAlert('Routine', `Opening ${routineKey} routine…`);
  };

  const isTongue = scanType === 'tongue';

  const handleShare = async () => {
    try {
      await Share.share({ message: buildShareText(results, glowScore, recommendations, isTongue) });
    } catch (e) {
      // user dismissed — no-op
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: headerTop }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MCIcon name="arrow-left" size={22} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Results</Text>
          <TouchableOpacity style={styles.backBtn} onPress={handleShare}>
            <MCIcon name="share-variant" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Enhanced / original preview */}
        {shownUri && !isTongue && (
          <View style={styles.previewWrap}>
            <Image
              source={{ uri: shownUri }}
              style={styles.previewImg}
              resizeMode="cover"
              onError={() => {
                // The enhanced (remote) image failed — drop back to the original
                // and hide the toggle so we never show a black frame.
                if (showEnhanced) setShowEnhanced(false);
                setEnhancedFailed(true);
              }}
            />
            {canShowEnhanced && (
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, showEnhanced && styles.toggleBtnOn]}
                  onPress={() => setShowEnhanced(true)}
                >
                  <MCIcon name="auto-fix" size={13} color={showEnhanced ? colors.white : colors.textSecondary} />
                  <Text style={[styles.toggleText, showEnhanced && styles.toggleTextOn]}>Enhanced</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, !showEnhanced && styles.toggleBtnOn]}
                  onPress={() => setShowEnhanced(false)}
                >
                  <Text style={[styles.toggleText, !showEnhanced && styles.toggleTextOn]}>Original</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

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

              {/* Wellness + skin age — surfaced here so they match the shared
                  report (previously only present in the share text). */}
              {(results.overallWellnessScore != null || results.skinAgeEstimate != null) && (
                <View style={styles.statChipsRow}>
                  {results.overallWellnessScore != null && (
                    <View style={styles.statChip}>
                      <Text style={styles.statChipValue}>{Math.round(results.overallWellnessScore)}</Text>
                      <Text style={styles.statChipLabel}>Wellness</Text>
                    </View>
                  )}
                  {results.skinAgeEstimate != null && (
                    <View style={styles.statChip}>
                      <Text style={styles.statChipValue}>{results.skinAgeEstimate}</Text>
                      <Text style={styles.statChipLabel}>Skin age est.</Text>
                    </View>
                  )}
                </View>
              )}
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
                ['Tongue Colour', results.tongueBodyColor],
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

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <MCIcon name="share-variant" size={18} color="#C850C0" />
            <Text style={styles.shareBtnText}>Share report</Text>
          </TouchableOpacity>
          {!isTongue && scan?.scan_id != null && (
            <TouchableOpacity
              style={[styles.shareBtn, { marginTop: 10 }]}
              onPress={() => navigation.navigate('ScanComparison', { scanId: scan.scan_id })}
              activeOpacity={0.85}
            >
              <MCIcon name="compare" size={18} color="#C850C0" />
              <Text style={styles.shareBtnText}>Compare to previous</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.historyLink}
            onPress={() => navigation.navigate('ScanHistory', { scanType })}
            activeOpacity={0.7}
          >
            <MCIcon name="history" size={16} color={colors.textSecondary} />
            <Text style={styles.historyLinkText}>View past scans</Text>
          </TouchableOpacity>
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

const makeStyles = colors => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#C850C0',
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
    color: colors.white,
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
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  statChipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 96,
  },
  statChipValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  statChipLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  tongueScoreBox: {
    alignItems: 'center',
    gap: 8,
  },
  tongueTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tongueSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  metricsBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tongueGrid: {
    backgroundColor: colors.card,
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
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tongueChip: {
    backgroundColor: 'rgba(200,80,192,0.12)',
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
    marginTop: 12,
  },
  doneBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Preview
  previewWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
    height: 360,
  },
  // Fill the fixed-height wrap; resizeMode="cover" crops the overflow. Setting
  // width:'100%' + aspectRatio + maxHeight together makes Yoga shrink the width
  // (leaving a black bar) — a fixed-height container avoids that entirely.
  previewImg: {
    width: '100%',
    height: '100%',
  },
  toggleRow: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    padding: 3,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  toggleBtnOn: { backgroundColor: '#C850C0' },
  toggleText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  toggleTextOn: { color: colors.white },

  // Share / history actions
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#C850C0',
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(200,80,192,0.12)',
  },
  shareBtnText: { color: '#C850C0', fontSize: 15, fontWeight: '700' },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  historyLinkText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
