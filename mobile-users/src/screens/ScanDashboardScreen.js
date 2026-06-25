import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import scanService from '../services/scanService';
import TrendChart from '../components/scan/TrendChart';
import useTheme from '../hooks/useTheme';

const METRICS = [
  { key: 'glow_score', label: 'Glow' },
  { key: 'hydration_score', label: 'Hydration' },
  { key: 'oiliness_score', label: 'Oil' },
  { key: 'wrinkle_score', label: 'Lines' },
];

function glowColor(score, muted = '#9CA3AF') {
  if (score == null) return muted;
  if (score >= 70) return '#22c55e';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

const ScanDashboardScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric] = useState('glow_score');
  const [points, setPoints] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await scanService.getDashboard();
      setDash(data);
      if (metric === 'glow_score') setPoints(data?.glowTrend ?? []);
    } catch (e) {
      setDash({ hasData: false, scanCount: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [metric]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const selectMetric = async (key) => {
    setMetric(key);
    if (key === 'glow_score') {
      setPoints(dash?.glowTrend ?? []);
      return;
    }
    try {
      const data = await scanService.getTrends({ metric: key });
      setPoints(data?.points ?? []);
    } catch (e) {
      setPoints([]);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  const latest = dash?.latest?.results ?? null;
  const glow = latest?.glowScore ?? null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Skin Dashboard</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ScanHistory')}>
          <MCIcon name="history" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#C850C0" size="large" /></View>
      ) : !dash?.hasData ? (
        <View style={styles.center}>
          <MCIcon name="chart-line" size={48} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>No analysis yet</Text>
          <Text style={styles.emptySub}>Scan your face to build your skin dashboard and track progress.</Text>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('FaceScan', { scanType: 'face' })}>
            <Text style={styles.ctaText}>Start a face scan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#C850C0']} />}
        >
          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.gauge, { borderColor: glowColor(glow) }]}>
              <Text style={[styles.gaugeNum, { color: glowColor(glow) }]}>
                {glow != null ? Math.round(glow) : '--'}
              </Text>
              <Text style={styles.gaugeLabel}>Glow</Text>
            </View>
            <View style={styles.statCol}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{dash.rollingGlow7d != null ? Math.round(dash.rollingGlow7d) : '--'}</Text>
                <Text style={styles.statLabel}>7-day avg glow</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{dash.scanCount}</Text>
                <Text style={styles.statLabel}>scans</Text>
              </View>
            </View>
          </View>

          {/* Metric selector + trend */}
          <View style={styles.chips}>
            {METRICS.map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.chip, metric === m.key && styles.chipOn]}
                onPress={() => selectMetric(m.key)}
              >
                <Text style={[styles.chipText, metric === m.key && styles.chipTextOn]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TrendChart
            points={points}
            title={`${METRICS.find(m => m.key === metric)?.label} over time`}
            dotColor={metric === 'glow_score' ? glowColor : undefined}
          />

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('FaceScan', { scanType: 'face' })}>
              <MCIcon name="face-recognition" size={20} color="#C850C0" />
              <Text style={styles.actionText}>New face scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('FaceScan', { scanType: 'tongue' })}>
              <MCIcon name="emoticon-tongue-outline" size={20} color="#C850C0" />
              <Text style={styles.actionText}>Tongue scan</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default ScanDashboardScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: '#C850C0',
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center' },
  cta: { marginTop: 12, backgroundColor: '#C850C0', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  gauge: {
    width: 110, height: 110, borderRadius: 55, borderWidth: 7,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card,
  },
  gaugeNum: { fontSize: 32, fontWeight: '900' },
  gaugeLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  statCol: { flex: 1, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, justifyContent: 'center',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: '#C850C0', borderColor: '#C850C0' },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.white },

  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(200,80,192,0.12)', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#f3e8ff',
  },
  actionText: { color: '#C850C0', fontWeight: '700', fontSize: 13.5 },
});
