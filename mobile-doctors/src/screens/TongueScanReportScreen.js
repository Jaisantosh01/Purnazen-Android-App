import React, { useState, useEffect } from 'react';
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
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import patientService from '../services/patientService';

const STATUS_CONFIG = {
  Healthy: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  'Thick Coat': { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  'Coated Tip': { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  Severe: { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

// ─── Metric Row Component ────────────────────────────────────────────────────
const MetricRow = ({ icon, label, value }) => (
  <View style={styles.metricRow}>
    <View style={styles.metricLabelWrap}>
      <MCIcon name={icon} size={18} color={COLORS.primary} style={styles.metricIcon} />
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const MetricDivider = () => <View style={styles.metricDivider} />;

// ─── Main Screen ───────────────────────────────────────────────────────────────
const TongueScanReportScreen = ({ route, navigation }) => {
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
      setError(err?.message || 'Failed to load tongue scan report.');
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
        <ScreenHeader title="Tongue Scan Report" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Tongue Scan Report" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={COLORS.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error || 'Report not found.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchReport}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[report.latestStatus] || STATUS_CONFIG['Coated Tip'];
  const recList = report.recommendations || ['No recommendations specified.'];

  const handleDownload = () => {
    showAlert(
      'Download Report',
      `Full Tongue Scan Report for ${patientName} has been downloaded successfully as a PDF.`,
      [{ text: 'OK' }]
    );
  };

  const handleShare = () => {
    showAlert(
      'Share Report',
      `Full Tongue Scan Report for ${patientName} is ready to be shared.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Tongue Scan Report"
        subtitle={patientName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.scoreContainer}>
            <View style={styles.avatarCircle}>
              <MCIcon name="camera-iris" size={32} color={COLORS.primary} />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.overallLabel}>Tongue Diagnostic Report</Text>
              <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
                <Text style={[styles.badgeText, { color: statusCfg.text }]}>{report.latestStatus}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tongue Metrics Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tongue Analysis Metrics</Text>
          <View style={styles.sectionDivider} />

          <MetricRow icon="palette-outline" label="Tongue Color" value={report.tongueColor} />
          <MetricDivider />
          <MetricRow icon="blur-linear" label="Coating" value={report.coating} />
          <MetricDivider />
          <MetricRow icon="water-percent" label="Moisture" value={report.moisture} />
          <MetricDivider />
          <MetricRow icon="chart-timeline-variant" label="Texture" value={report.texture} />
          <MetricDivider />
          <MetricRow icon="thermometer" label="Temperature" value={report.temperature} />
          <MetricDivider />
          <MetricRow icon="clipboard-pulse-outline" label="Analysis" value={report.analysis} />
        </View>

        {/* Recommendations Section */}
        <View style={styles.sectionCard}>
          <View style={styles.recommendationsHeader}>
            <MCIcon name="lightbulb-on-outline" size={20} color={COLORS.primary} style={styles.recIcon} />
            <Text style={styles.sectionTitle}>Treatment Recommendations</Text>
          </View>
          <View style={styles.sectionDivider} />

          {recList.map((rec, index) => (
            <View key={index} style={styles.recRow}>
              <MCIcon name="check-circle" size={16} color={COLORS.success} style={styles.recCheck} />
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

export default TongueScanReportScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: 14.5, color: COLORS.textSecondary, fontWeight: '500', textAlign: 'center', marginBottom: SPACING.md },
  retryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.md },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: 13.5 },

  // Summary Card (Top Section)
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextWrap: {
    flex: 1,
    gap: 4,
  },
  overallLabel: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
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
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.textPrimary,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
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
    flex: 1,
    paddingRight: SPACING.md,
  },
  metricIcon: {
    marginRight: 10,
  },
  metricLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  metricValue: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    fontWeight: '600',
    flex: 1.2,
    textAlign: 'right',
  },
  metricDivider: {
    height: 1,
    backgroundColor: COLORS.surfaceMuted,
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
    color: COLORS.textSecondary,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Footer & View Buttons
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  downloadBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  shareBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
