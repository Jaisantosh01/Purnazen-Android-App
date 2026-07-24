import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import scanService from '../services/scanService';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

// metricKey → { label, higherIsBetter }
const METRICS = {
  glowScore:            { label: 'Glow', higher: true },
  overallWellnessScore: { label: 'Wellness', higher: true },
  hydrationScore:       { label: 'Hydration', higher: true },
  elasticityScore:      { label: 'Elasticity', higher: true },
  oilinessScore:        { label: 'Oiliness', higher: false },
  wrinkleScore:         { label: 'Fine lines', higher: false },
  pigmentationScore:    { label: 'Pigmentation', higher: false },
  darkCircleScore:      { label: 'Dark circles', higher: false },
  poreScore:            { label: 'Pores', higher: false },
  inflammationScore:    { label: 'Inflammation', higher: false },
  toxinIndicator:       { label: 'Toxin indicator', higher: false },
};

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function pretty(v) {
  if (v == null) return '—';
  return String(v).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

const ScanComparisonScreen = ({ navigation, route }) => {
  const headerTop = useHeaderTopPadding();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { scanId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    scanService
      .compareScan(scanId)
      .then(setData)
      .catch(() => setError('Could not load comparison. Please try again.'))
      .finally(() => setLoading(false));
  }, [scanId]);

  const renderRow = (key) => {
    const meta = METRICS[key];
    const delta = data?.deltas?.[key];
    const cur = data?.current?.results?.[key];
    const base = data?.baseline?.results?.[key];
    if (delta == null || cur == null || base == null) return null;

    const improved = meta.higher ? delta > 0 : delta < 0;
    const worse = meta.higher ? delta < 0 : delta > 0;
    const color = delta === 0 ? colors.textMuted : improved ? '#22c55e' : worse ? '#ef4444' : colors.textMuted;
    const arrow = delta === 0 ? 'minus' : delta > 0 ? 'arrow-up' : 'arrow-down';

    return (
      <View key={key} style={styles.row}>
        <Text style={styles.metricLabel}>{meta.label}</Text>
        <View style={styles.values}>
          <Text style={styles.baseVal}>{Math.round(base)}</Text>
          <MCIcon name="arrow-right-thin" size={16} color={colors.textMuted} />
          <Text style={styles.curVal}>{Math.round(cur)}</Text>
        </View>
        <View style={[styles.deltaPill, { backgroundColor: `${color}1a` }]}>
          <MCIcon name={arrow} size={13} color={color} />
          <Text style={[styles.deltaText, { color }]}>{Math.abs(delta).toFixed(0)}</Text>
        </View>
      </View>
    );
  };

  const isTongue = data?.scanType === 'tongue';

  const renderTongueBody = () => {
    const delta = data?.wellnessDelta;
    const improved = delta != null && delta > 0;
    const worse = delta != null && delta < 0;
    const color = delta == null || delta === 0 ? colors.textMuted : improved ? '#22c55e' : '#ef4444';
    const cur = data?.current?.results?.overallWellnessScore;

    return (
      <>
        {/* Wellness hero */}
        <View style={styles.wellnessCard}>
          <Text style={styles.wellnessLabel}>Overall wellness</Text>
          <View style={styles.wellnessRow}>
            <Text style={styles.wellnessNum}>{cur != null ? Math.round(cur) : '--'}</Text>
            {delta != null && (
              <View style={[styles.deltaPill, { backgroundColor: `${color}1a` }]}>
                <MCIcon name={delta === 0 ? 'minus' : delta > 0 ? 'arrow-up' : 'arrow-down'} size={13} color={color} />
                <Text style={[styles.deltaText, { color }]}>{Math.abs(delta).toFixed(0)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.muted}>
            {delta == null || delta === 0 ? 'No change vs previous scan'
              : improved ? 'Higher than your previous scan'
              : 'Lower than your previous scan'}
          </Text>
        </View>

        {/* Per-marker before → after */}
        <Text style={styles.subhead}>TCM markers</Text>
        <View style={styles.card}>
          {(data?.markerChanges || []).map((m, i) => (
            <View key={m.key} style={[styles.markerRow, i > 0 && styles.markerDivider]}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <View style={styles.markerValues}>
                <Text style={styles.baseVal}>{pretty(m.baseline)}</Text>
                <MCIcon name="arrow-right-thin" size={16} color={colors.textMuted} />
                <Text style={[styles.curVal, m.changed && { color: '#C850C0' }]}>{pretty(m.current)}</Text>
              </View>
              <MCIcon
                name={m.changed ? 'swap-horizontal' : 'equal'}
                size={16}
                color={m.changed ? '#C850C0' : colors.textMuted}
                style={styles.markerFlag}
              />
            </View>
          ))}
        </View>
        <Text style={styles.hint}>Purple = a marker that shifted since your previous scan</Text>
      </>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#C850C0" size="large" /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>
      ) : data && data.hasBaseline === false ? (
        <View style={styles.center}>
          <MCIcon name="compare" size={46} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>Nothing to compare yet</Text>
          <Text style={styles.muted}>
            This is your first {isTongue ? 'tongue ' : ''}scan. Scan again later to track progress.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={styles.caption}>
            {fmtDate(data?.baseline?.createdAt)} → {fmtDate(data?.current?.createdAt)}
          </Text>
          {isTongue ? (
            renderTongueBody()
          ) : (
            <>
              <View style={styles.card}>{Object.keys(METRICS).map(renderRow)}</View>
              <Text style={styles.hint}>Green = improvement vs your previous scan</Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default ScanComparisonScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: '#C850C0',
    paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  muted: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center' },
  caption: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 8,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  metricLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  values: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 96, justifyContent: 'center' },
  baseVal: { fontSize: 14, color: colors.textMuted },
  curVal: { fontSize: 15, color: colors.textPrimary, fontWeight: '800' },
  deltaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, width: 56, justifyContent: 'center',
  },
  deltaText: { fontSize: 13, fontWeight: '800' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 10 },

  // Tongue comparison
  wellnessCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 18, alignItems: 'center', gap: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  wellnessLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  wellnessRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wellnessNum: { fontSize: 40, fontWeight: '900', color: colors.textPrimary },
  subhead: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 20, marginBottom: 10 },
  markerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 10,
  },
  markerDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  markerValues: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  markerFlag: { width: 24, textAlign: 'right' },
});
