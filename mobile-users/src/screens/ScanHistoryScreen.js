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
import { showAlert } from '../utils/alert';
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import useTheme from '../hooks/useTheme';
import { useHeaderTopPadding } from '../components/ScreenHeader';

function glowColor(score, muted = '#9CA3AF') {
  if (score == null) return muted;
  if (score >= 70) return '#22c55e';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Lightweight glow-score trend line (no chart lib). `points` oldest→newest. */
function GlowTrend({ points, styles, colors, title = 'Glow score over time' }) {
  const W = 300;
  const H = 90;
  const pad = 10;
  if (points.length < 2) return null;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 100);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (H - pad * 2);
    return [x, y];
  });
  const polyline = coords.map(c => c.join(',')).join(' ');
  return (
    <View style={styles.trendCard}>
      <Text style={styles.trendTitle}>{title}</Text>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <SvgLine x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={colors.border} strokeWidth={1} />
        <Polyline points={polyline} fill="none" stroke={colors.primary} strokeWidth={2.5} />
        {coords.map((c, i) => (
          <Circle key={i} cx={c[0]} cy={c[1]} r={3.5} fill={glowColor(points[i], colors.textMuted)} />
        ))}
      </Svg>
    </View>
  );
}

const ScanHistoryScreen = ({ navigation, route }) => {
  const headerTop = useHeaderTopPadding();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Face and tongue histories are kept separate — each entry point passes its
  // own scanType so the two report types are never mixed in one list.
  const scanType = route?.params?.scanType === 'tongue' ? 'tongue' : 'face';
  const isTongue = scanType === 'tongue';
  // Score shown per row: glow for skin scans, wellness for tongue scans.
  const scoreOf = useCallback(
    (s) => (isTongue ? s?.overallWellnessScore : s?.glowScore),
    [isTongue],
  );
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);
  const setHistory = useScanStore(s => s.setHistory);
  const removeScanFromHistory = useScanStore(s => s.removeScanFromHistory);

  const load = useCallback(async () => {
    try {
      const data = await scanService.getHistory({ scanType, limit: 50 });
      const scans = data?.scans ?? [];
      setItems(scans);
      setHistory(scans);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setHistory, scanType]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openScan = async (item) => {
    if (item.status !== 'completed') {
      showAlert('Not ready', 'This scan didn’t finish analysing.');
      return;
    }
    setOpening(true);
    try {
      const payload = await scanService.getScanStatus(item.id);
      navigation.navigate('ScanResults', { scan: payload });
    } catch (e) {
      showAlert('Error', 'Could not open this scan. Please try again.');
    } finally {
      setOpening(false);
    }
  };

  const confirmDelete = (item) => {
    showAlert('Delete scan?', 'This permanently removes the scan and its results.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await scanService.deleteScan(item.id);
            removeScanFromHistory(item.id);
            setItems(prev => prev.filter(s => s.id !== item.id));
          } catch (e) {
            showAlert('Error', 'Could not delete this scan.');
          }
        },
      },
    ]);
  };

  const completed = items.filter(s => s.status === 'completed' && scoreOf(s) != null);
  const trendPoints = [...completed].reverse().map(scoreOf); // oldest→newest

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />

      <View style={[styles.header, { paddingTop: headerTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isTongue ? 'Tongue Scan History' : 'Skin Scan History'}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#C850C0" size="large" /></View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <MCIcon name="history" size={48} color={colors.borderStrong} />
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySub}>
            {isTongue
              ? 'Run a tongue scan to start tracking your wellness over time.'
              : 'Run a face scan to start tracking your skin over time.'}
          </Text>
          <TouchableOpacity
            style={styles.scanCta}
            onPress={() => navigation.navigate(isTongue ? 'TongueScan' : 'FaceScan', { scanType })}
          >
            <Text style={styles.scanCtaText}>Start a scan</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#C850C0']} />}
        >
          <GlowTrend
            points={trendPoints}
            styles={styles}
            colors={colors}
            title={isTongue ? 'Wellness score over time' : 'Glow score over time'}
          />

          {items.map(item => {
            const score = scoreOf(item);
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.row}
                activeOpacity={0.8}
                onPress={() => openScan(item)}
                onLongPress={() => confirmDelete(item)}
              >
                <View style={[styles.scoreBadge, { borderColor: glowColor(score, colors.textMuted) }]}>
                  <Text style={[styles.scoreNum, { color: glowColor(score, colors.textMuted) }]}>
                    {score != null ? Math.round(score) : '--'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
                  <Text style={styles.rowMeta}>
                    {item.status === 'completed'
                      ? (isTongue
                          ? `Wellness ${item.overallWellnessScore != null ? Math.round(item.overallWellnessScore) : '--'}`
                          : `Glow ${item.glowScore != null ? Math.round(item.glowScore) : '--'} · Wellness ${item.overallWellnessScore != null ? Math.round(item.overallWellnessScore) : '--'}`)
                      : item.status}
                  </Text>
                </View>
                <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}

          <Text style={styles.hint}>Long-press a scan to delete it</Text>
        </ScrollView>
      )}

      {opening && (
        <View style={styles.overlay}><ActivityIndicator color="#fff" size="large" /></View>
      )}
    </View>
  );
};

export default ScanHistoryScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: '#C850C0',
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  emptySub: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center' },
  scanCta: { marginTop: 12, backgroundColor: '#C850C0', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  scanCtaText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  trendCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  trendTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  scoreBadge: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  scoreNum: { fontSize: 17, fontWeight: '800' },
  rowDate: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
});
