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
  Healthy: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  'Thick Coat': { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  'Coated Tip': { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  Severe: { bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

// ─── Scan Card Component ─────────────────────────────────────────────────────
const ScanCard = ({ item, onPress }) => (
  <TouchableOpacity
    style={styles.card}
    activeOpacity={0.85}
    onPress={() => onPress(item)}>
    <View style={styles.cardInfo}>
      <Text style={styles.cardDate}>{item.date}</Text>
      <Text style={styles.cardResult}>Result: <Text style={styles.resultHighlight}>{item.result}</Text></Text>
      <Text style={styles.cardMoisture}>Moisture: <Text style={styles.moistureHighlight}>{item.moisture}</Text></Text>
    </View>
    <MCIcon name="chevron-right" size={24} color={COLORS.textMuted} />
  </TouchableOpacity>
);

const ScanSeparator = () => <View style={styles.separator} />;

// ─── Main Screen ───────────────────────────────────────────────────────────────
const TongueScanHistoryScreen = ({ route, navigation }) => {
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
      const data = await patientService.scanHistory(patientId, 'tongue');
      setHistory(data);
    } catch (err) {
      setError(err?.message || 'Failed to load tongue scan history.');
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
    navigation.navigate('TongueScanReport', { patientId, scanId: scan.id });
  };

  const handleViewReport = () => {
    if (history.length > 0) {
      navigation.navigate('TongueScanReport', { patientId, scanId: history[0].id });
    }
  };

  // Compute latest scan values
  const hasScans = history.length > 0;
  const latestScan = hasScans ? history[0] : null;
  const latestStatus = latestScan && latestScan.result ? (latestScan.result.toLowerCase().includes('healthy') ? 'Healthy' : 'Coated Tip') : 'Healthy';
  const statusCfg = STATUS_CONFIG[latestStatus] || STATUS_CONFIG.Healthy;

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Tongue Scan History"
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
              /* Top Summary Card */
              <View style={styles.summaryCard}>
                <View style={styles.scoreContainer}>
                  <View style={styles.avatarCircle}>
                    <MCIcon name="camera-iris" size={32} color={COLORS.primary} />
                  </View>
                  <View style={styles.summaryTextWrap}>
                    <Text style={styles.overallLabel}>Latest Tongue Scan</Text>
                    <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                      <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
                      <Text style={[styles.badgeText, { color: statusCfg.text }]}>{latestStatus}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.trendRow}>
                  <MCIcon name="check-decagram" size={18} color={COLORS.primary} />
                  <Text style={styles.trendText}>
                    Tongue diagnosis analysis loaded successfully from AI pipeline parameters.
                  </Text>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="camera-iris" size={60} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No Tongue Scans</Text>
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

export default TongueScanHistoryScreen;

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
  cardResult: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  resultHighlight: {
    color: COLORS.primary,
  },
  cardMoisture: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  moistureHighlight: {
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
