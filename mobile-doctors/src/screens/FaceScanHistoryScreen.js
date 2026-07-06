import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import patientService from '../services/patientService';

const STATUS_CONFIG = {
  Good: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  Fair: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  Poor: { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

// ─── Timeline Item / Card Component ───────────────────────────────────────────
const ScanCard = ({ item, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    activeOpacity={0.85}
    onPress={() => onPress(item)}>
    <View style={styles.cardInfo}>
      <Text style={styles.cardDate}>{item.date}</Text>
      <Text style={styles.cardScore}>Skin Score: <Text style={styles.scoreHighlight}>{item.score}/100</Text></Text>
      <Text style={styles.cardCondition} numberOfLines={1}>
        Condition: <Text style={styles.conditionHighlight}>{item.condition || 'N/A'}</Text>
      </Text>
    </View>
    <MCIcon name="chevron-right" size={24} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const ScanSeparator = () => <View style={styles.separator} />;

// ─── Main Screen ───────────────────────────────────────────────────────────────
const FaceScanHistoryScreen = ({ route, navigation }) => {
  const { patientId } = route.params || {};
  const [patientName, setPatientName] = useState('Patient');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const patient = await patientService.detail(patientId);
      if (patient) {
        setPatientName(patient.name);
      }
      const data = await patientService.scanHistory(patientId, 'face');
      setHistory(data);
    } catch (err) {
      setError(err?.message || 'Failed to load face scan history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchHistory();
    }
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(false);
  };

  const handleScanPress = (scan) => {
    navigation.navigate('FaceScanReport', { patientId, scanId: scan.id });
  };

  const handleViewReport = () => {
    if (history.length > 0) {
      navigation.navigate('FaceScanReport', { patientId, scanId: history[0].id });
    }
  };

  // Compute latest scan values
  const hasScans = history.length > 0;
  const latestScan = hasScans ? history[0] : null;
  const overallScore = latestScan ? latestScan.score : 0;
  const latestStatus = latestScan ? (latestScan.score >= 80 ? 'Good' : 'Fair') : 'Fair';
  const statusCfg = STATUS_CONFIG[latestStatus] || STATUS_CONFIG.Fair;

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Face Scan History"
        subtitle={patientName}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={COLORS.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchHistory()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ScanCard item={item} onPress={handleScanPress} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ScanSeparator}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListHeaderComponent={
            hasScans ? (
              /* Top Score Summary Card */
              <View style={styles.summaryCard}>
                <View style={styles.scoreContainer}>
                  <View style={styles.scoreCircle}>
                    <Text style={styles.overallScoreText}>{overallScore}</Text>
                    <Text style={styles.scoreMaxText}>/100</Text>
                  </View>
                  <View style={styles.summaryTextWrap}>
                    <Text style={styles.overallLabel}>Overall Skin Score</Text>
                    <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                      <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
                      <Text style={[styles.badgeText, { color: statusCfg.text }]}>{latestStatus}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.trendRow}>
                  <MCIcon name="trending-up" size={18} color={COLORS.success} />
                  <Text style={styles.trendText}>
                    Skin health score is loaded successfully from AI pipeline diagnostics.
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="face-recognition" size={60} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No Face Scans</Text>
              <Text style={styles.emptySubtitle}>No scans found for this patient.</Text>
            </View>
          }
        />
      )}

      {/* Floating Bottom Button */}
      {hasScans && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.reportBtn}
            activeOpacity={0.85}
            onPress={handleViewReport}>
            <Text style={styles.reportBtnText}>View Full Report</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default FaceScanHistoryScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.lg, paddingBottom: 100 },

  // Summary Card (Top Section)
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    gap: SPACING.md,
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
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  overallScoreText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  scoreMaxText: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
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
    color: COLORS.textPrimary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Timeline List Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardDate: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  cardScore: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  scoreHighlight: {
    color: COLORS.primary,
  },
  cardCondition: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  conditionHighlight: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // Badges
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
    fontSize: 11,
    fontWeight: '700',
  },

  // Sticky Footer Action
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reportBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportBtnText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
  separator: {
    height: SPACING.md,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 14.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
});
