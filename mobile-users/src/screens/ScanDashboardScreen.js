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
import { useHeaderTopPadding } from '../components/ScreenHeader';

const GLOW = '#C850C0';

// Face metrics chartable in the dashboard (higher = whether up is good).
const FACE_METRICS = [
  { key: 'glow_score', label: 'Glow', higher: true },
  { key: 'hydration_score', label: 'Hydration', higher: true },
  { key: 'oiliness_score', label: 'Oil', higher: false },
  { key: 'wrinkle_score', label: 'Lines', higher: false },
];

// TCM tongue markers → display label, ideal value(s), icon.
const TONGUE_MARKERS = [
  { key: 'tongueBodyColor', label: 'Body colour', ideal: ['normal'], icon: 'palette-outline' },
  { key: 'tongueCoatColor', label: 'Coat colour', ideal: ['white'], icon: 'layers-outline' },
  { key: 'tongueCoatThick', label: 'Coat thickness', ideal: ['thin'], icon: 'format-line-weight' },
  { key: 'tongueMoisture', label: 'Moisture', ideal: ['moist'], icon: 'water-outline' },
  { key: 'tongueShape', label: 'Shape', ideal: ['normal'], icon: 'vector-square' },
];

function glowColor(score, muted = '#9CA3AF') {
  if (score == null) return muted;
  if (score >= 70) return '#22c55e';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

function pretty(v) {
  if (v == null) return '—';
  return String(v).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

const ScanDashboardScreen = ({ navigation }) => {
  const headerTop = useHeaderTopPadding();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState('face'); // 'face' | 'tongue'
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric] = useState('glow_score');
  const [points, setPoints] = useState([]);

  const loadDashboard = useCallback(async (m) => {
    setLoading(true);
    try {
      const data = await scanService.getDashboard({ scanType: m });
      setDash(data);
      if (m === 'face') {
        setMetric('glow_score');
        setPoints(data?.glowTrend ?? []);
      } else {
        setPoints(data?.wellnessTrend ?? []);
      }
    } catch (e) {
      setDash({ scanType: m, hasData: false, scanCount: 0 });
      setPoints([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(mode); }, [mode, loadDashboard]);

  const selectMetric = async (key) => {
    setMetric(key);
    if (key === 'glow_score') {
      setPoints(dash?.glowTrend ?? []);
      return;
    }
    try {
      const data = await scanService.getTrends({ metric: key, scanType: 'face' });
      setPoints(data?.points ?? []);
    } catch (e) {
      setPoints([]);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadDashboard(mode); };

  const latest = dash?.latest?.results ?? null;
  const glow = latest?.glowScore ?? null;
  const wellness = latest?.overallWellnessScore ?? null;
  const activeMeta = FACE_METRICS.find(m => m.key === metric) || FACE_METRICS[0];

  const Toggle = (
    <View style={styles.toggle}>
      {[
        { key: 'face', label: 'Skin', icon: 'face-recognition' },
        { key: 'tongue', label: 'Tongue', icon: 'emoticon-tongue-outline' },
      ].map(t => (
        <TouchableOpacity
          key={t.key}
          style={[styles.toggleBtn, mode === t.key && styles.toggleBtnOn]}
          onPress={() => setMode(t.key)}
          activeOpacity={0.85}
        >
          <MCIcon name={t.icon} size={16} color={mode === t.key ? colors.white : colors.textSecondary} />
          <Text style={[styles.toggleText, mode === t.key && styles.toggleTextOn]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={GLOW} />
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'face' ? 'Skin Dashboard' : 'Tongue Dashboard'}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ScanHistory')}>
          <MCIcon name="history" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={GLOW} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GLOW]} />}
        >
          {Toggle}

          {!dash?.hasData ? (
            <View style={styles.emptyBox}>
              <MCIcon
                name={mode === 'face' ? 'chart-line' : 'emoticon-tongue-outline'}
                size={46}
                color={colors.borderStrong}
              />
              <Text style={styles.emptyTitle}>No analysis yet</Text>
              <Text style={styles.emptySub}>
                {mode === 'face'
                  ? 'Scan your face to build your skin dashboard and track progress.'
                  : 'Scan your tongue to build your TCM wellness dashboard and track progress.'}
              </Text>
              <TouchableOpacity
                style={styles.cta}
                onPress={() =>
                  mode === 'face'
                    ? navigation.navigate('FaceScan', { scanType: 'face' })
                    : navigation.navigate('TongueScan')
                }
              >
                <Text style={styles.ctaText}>{mode === 'face' ? 'Start a face scan' : 'Start a tongue scan'}</Text>
              </TouchableOpacity>
            </View>
          ) : mode === 'face' ? (
            <>
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
                {FACE_METRICS.map(m => (
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
                title={`${activeMeta.label} over time`}
                colors={colors}
                higherIsBetter={activeMeta.higher}
                color={GLOW}
                dotColor={metric === 'glow_score' ? glowColor : undefined}
              />
            </>
          ) : (
            <>
              {/* Tongue summary */}
              <View style={styles.summaryRow}>
                <View style={[styles.gauge, { borderColor: glowColor(wellness) }]}>
                  <Text style={[styles.gaugeNum, { color: glowColor(wellness) }]}>
                    {wellness != null ? Math.round(wellness) : '--'}
                  </Text>
                  <Text style={styles.gaugeLabel}>Wellness</Text>
                </View>
                <View style={styles.statCol}>
                  <View style={styles.statCard}>
                    <Text style={styles.statNum}>{dash.rollingWellness7d != null ? Math.round(dash.rollingWellness7d) : '--'}</Text>
                    <Text style={styles.statLabel}>7-day avg wellness</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statNum}>{dash.scanCount}</Text>
                    <Text style={styles.statLabel}>scans</Text>
                  </View>
                </View>
              </View>

              <TrendChart
                points={points}
                title="Wellness over time"
                colors={colors}
                higherIsBetter
                color={GLOW}
                dotColor={glowColor}
              />

              {/* Latest TCM markers */}
              <Text style={styles.sectionTitle}>Latest tongue reading</Text>
              <View style={styles.markerCard}>
                {TONGUE_MARKERS.map((m, i) => {
                  const val = dash.markers?.[m.key];
                  const ideal = val != null && m.ideal.includes(String(val));
                  return (
                    <View key={m.key} style={[styles.markerRow, i > 0 && styles.markerDivider]}>
                      <View style={styles.markerLeft}>
                        <MCIcon name={m.icon} size={18} color={colors.textSecondary} />
                        <Text style={styles.markerLabel}>{m.label}</Text>
                      </View>
                      <View style={[styles.markerPill, { backgroundColor: ideal ? '#22c55e1a' : `${colors.textMuted}1a` }]}>
                        {val != null && (
                          <MCIcon
                            name={ideal ? 'check-circle' : 'alert-circle-outline'}
                            size={13}
                            color={ideal ? '#22c55e' : colors.textMuted}
                          />
                        )}
                        <Text style={[styles.markerVal, { color: ideal ? '#16a34a' : colors.textPrimary }]}>
                          {pretty(val)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.hint}>Green markers are in the balanced (healthy) range.</Text>
            </>
          )}

          {/* Actions */}
          {dash?.hasData && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('FaceScan', { scanType: 'face' })}>
                <MCIcon name="face-recognition" size={20} color={GLOW} />
                <Text style={styles.actionText}>New face scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('TongueScan')}>
                <MCIcon name="emoticon-tongue-outline" size={20} color={GLOW} />
                <Text style={styles.actionText}>Tongue scan</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default ScanDashboardScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: GLOW,
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },

  toggle: {
    flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: 12,
    padding: 4, marginBottom: 16,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 9,
  },
  toggleBtnOn: { backgroundColor: GLOW },
  toggleText: { fontSize: 13.5, fontWeight: '700', color: colors.textSecondary },
  toggleTextOn: { color: colors.white },

  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 12 },
  cta: { marginTop: 12, backgroundColor: GLOW, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
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
  chipOn: { backgroundColor: GLOW, borderColor: GLOW },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: colors.white },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 20, marginBottom: 10 },
  markerCard: {
    backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  markerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  markerDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  markerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markerLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  markerPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  markerVal: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 10 },

  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(200,80,192,0.12)', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(200,80,192,0.18)',
  },
  actionText: { color: GLOW, fontWeight: '700', fontSize: 13.5 },
});
