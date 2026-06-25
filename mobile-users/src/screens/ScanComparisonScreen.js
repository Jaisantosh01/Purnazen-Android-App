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

// metricKey → { label, higherIsBetter }
const METRICS = {
  glowScore:            { label: 'Glow', higher: true },
  overallWellnessScore: { label: 'Wellness', higher: true },
  hydrationScore:       { label: 'Hydration', higher: true },
  elasticityScore:      { label: 'Elasticity', higher: true },
  muscleToneScore:      { label: 'Muscle tone', higher: true },
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

const ScanComparisonScreen = ({ navigation, route }) => {
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

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />
      <View style={styles.header}>
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
          <Text style={styles.muted}>This is your first scan. Scan again later to track progress.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={styles.caption}>
            {fmtDate(data?.baseline?.createdAt)} → {fmtDate(data?.current?.createdAt)}
          </Text>
          <View style={styles.card}>{Object.keys(METRICS).map(renderRow)}</View>
          <Text style={styles.hint}>Green = improvement vs your previous scan</Text>
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
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20,
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
});
