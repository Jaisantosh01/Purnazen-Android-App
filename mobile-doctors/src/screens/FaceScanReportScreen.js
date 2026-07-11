import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import patientService from '../services/patientService';

const STATUS_CONFIG = {
  Good: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  Fair: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  Poor: { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

// ─── Metric Row Component ────────────────────────────────────────────────────
const MetricRow = ({ icon, label, value }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={styles.metricRow}>
    <View style={styles.metricLabelWrap}>
      <MCIcon name={icon} size={18} color={colors.primary} style={styles.metricIcon} />
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
  );
};

const MetricDivider = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.metricDivider} />;
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
const FaceScanReportScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { patientId, scanId } = route.params || {};
  const [patientName, setPatientName] = useState('Patient');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const patient = await patientService.detail(patientId);
      if (patient) {
        setPatientName(patient.name);
      }
      const data = await patientService.scanReport(patientId, scanId);
      setReport(data);
    } catch (err) {
      setError(err?.message || 'Failed to load face scan report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId && scanId) {
      fetchReport();
    }
  }, [patientId, scanId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Face Scan Report" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Face Scan Report" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={colors.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error || 'Report not found.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchReport}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.Fair;
  const recList = report.recommendations || ['No recommendations specified.'];

  const handleDownload = () => {
    showAlert(
      'Download Report',
      `Full Face Scan Report for ${patientName} has been downloaded successfully as a PDF.`,
      [{ text: 'OK' }]
    );
  };

  const handleShare = () => {
    showAlert(
      'Share Report',
      `Full Face Scan Report for ${patientName} is ready to be shared.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Face Scan Report"
        subtitle={patientName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.scoreContainer}>
            <View style={styles.scoreCircle}>
              <Text style={styles.overallScoreText}>{report.overallScore}</Text>
              <Text style={styles.scoreMaxText}>/100</Text>
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.overallLabel}>Overall Skin Score</Text>
              <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
                <Text style={[styles.badgeText, { color: statusCfg.text }]}>{report.status}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Skin Metrics List Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Skin Analysis Metrics</Text>
          <View style={styles.sectionDivider} />

          <MetricRow icon="account-clock" label="Skin Age" value={report.skinAge} />
          <MetricDivider />
          <MetricRow icon="water-percent" label="Hydration" value={report.hydration} />
          <MetricDivider />
          <MetricRow icon="oil" label="Oil Level" value={report.oilLevel} />
          <MetricDivider />
          <MetricRow icon="palette-outline" label="Pigmentation" value={report.pigmentation} />
          <MetricDivider />
          <MetricRow icon="eye-circle-outline" label="Dark Circles" value={report.darkCircles} />
          <MetricDivider />
          <MetricRow icon="chart-timeline-variant" label="Fine Lines" value={report.fineLines} />
          <MetricDivider />
          <MetricRow icon="alert-decagram-outline" label="Acne" value={report.acne} />
        </View>

        {/* Recommendations Section */}
        <View style={styles.sectionCard}>
          <View style={styles.recommendationsHeader}>
            <MCIcon name="lightbulb-on-outline" size={20} color={colors.primary} style={styles.recIcon} />
            <Text style={styles.sectionTitle}>Treatment Recommendations</Text>
          </View>
          <View style={styles.sectionDivider} />

          {recList.map((rec, index) => (
            <View key={index} style={styles.recRow}>
              <MCIcon name="check-circle" size={16} color={colors.success} style={styles.recCheck} />
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer Anchored Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.downloadBtn}
          activeOpacity={0.8}
          onPress={handleDownload}>
          <Text style={styles.downloadBtnText}>Download Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          activeOpacity={0.85}
          onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default FaceScanReportScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = colors =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: 14.5, color: colors.textSecondary, fontWeight: '500', textAlign: 'center', marginBottom: SPACING.md },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.md },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 13.5 },

  // Summary Card (Top Section)
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  overallScoreText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
  },
  scoreMaxText: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '700',
    marginTop: 6,
  },
  summaryTextWrap: {
    flex: 1,
    gap: 4,
  },
  overallLabel: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },

  // Badge Styling
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  // Metrics Section Cards
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: SPACING.md,
  },

  // Metric Rows
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  metricLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricIcon: {
    marginRight: 10,
  },
  metricLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metricValue: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metricDivider: {
    height: 1,
    backgroundColor: colors.surfaceMuted,
    marginVertical: SPACING.sm,
  },

  // Recommendations
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recIcon: {
    marginRight: 8,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    paddingRight: SPACING.md,
  },
  recCheck: {
    marginRight: 8,
    marginTop: 2,
  },
  recText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Footer & View Buttons
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  downloadBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  shareBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
