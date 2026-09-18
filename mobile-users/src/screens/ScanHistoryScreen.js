import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { showAlert } from '../utils/alert';
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import scanService from '../services/scanService';
import useScanStore from '../store/scanStore';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { ListSkeleton } from '../components/SkeletonLoader';

const GLOW = '#C850C0';

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

/** "face scan from 3 Aug 2026" — identifies one scan in prose. */
function describeScan(item) {
  const kind = item?.scanType === 'tongue' ? 'tongue scan' : 'face scan';
  const taken = formatDate(item?.createdAt);
  return taken ? `${kind} from ${taken}` : kind;
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Default from the entry route, then let the user flip Skin ↔ Tongue tabs.
  const initialType = route?.params?.scanType === 'tongue' ? 'tongue' : 'face';
  const [scanType, setScanType] = useState(initialType);
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
  const [deletingId, setDeletingId] = useState(null);
  const setHistory = useScanStore(s => s.setHistory);
  const removeScanFromHistory = useScanStore(s => s.removeScanFromHistory);

  // Keep tab in sync if another screen navigates here with a different scanType.
  useEffect(() => {
    setScanType(route?.params?.scanType === 'tongue' ? 'tongue' : 'face');
  }, [route?.params?.scanType]);

  const load = useCallback(async () => {
    setLoading(true);
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

  // Names the scan being removed (type + date) so it is unmistakable *which*
  // one is going, and so a mis-tap on the wrong row is caught at the dialog.
  const confirmDelete = (item) => {
    if (deletingId) return;
    showAlert(
      'Delete this scan?',
      `Your ${describeScan(item)} will be permanently deleted, along with its `
        + 'results and recommendations. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await scanService.deleteScan(item.id);
              // Drop it from the shared store too, so the dashboard's "latest
              // scan" card doesn't keep showing a scan that no longer exists.
              removeScanFromHistory(item.id);
              setItems(prev => prev.filter(s => s.id !== item.id));
            } catch (e) {
              showAlert('Error', 'Could not delete this scan. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const completed = items.filter(s => s.status === 'completed' && scoreOf(s) != null);
  const trendPoints = [...completed].reverse().map(scoreOf); // oldest→newest

  const TabBar = (
    <View style={styles.tabs}>
      {[
        { key: 'face', label: 'Skin', icon: 'face-recognition' },
        { key: 'tongue', label: 'Tongue', icon: 'emoticon-tongue-outline' },
      ].map(t => {
        const on = scanType === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, on && styles.tabBtnOn]}
            onPress={() => { if (!on) setScanType(t.key); }}
            activeOpacity={0.85}
          >
            <MCIcon name={t.icon} size={16} color={on ? colors.white : colors.textSecondary} />
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title="Scan History" subtitle="Skin and tongue scans over time" background={GLOW} backBehavior="popToRoot" />

      {TabBar}

      {loading ? (
        <ListSkeleton count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          accent={GLOW}
          icon={isTongue ? 'emoticon-tongue-outline' : 'face-recognition'}
          title={`No ${isTongue ? 'tongue' : 'skin'} scans yet`}
          hint={isTongue
            ? 'Run a tongue scan to start tracking your wellness over time.'
            : 'Run a face scan to start tracking your skin over time.'}
          action={{ label: 'Start a scan', onPress: () => navigation.navigate(isTongue ? 'TongueScan' : 'FaceScan', { scanType }) }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={inline.p16_pb40}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GLOW]} />}
        >
          <GlowTrend
            points={trendPoints}
            styles={styles}
            colors={colors}
            title={isTongue ? 'Wellness score over time' : 'Glow score over time'}
          />

          {items.map(item => {
            const score = scoreOf(item);
            const isDeleting = deletingId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, isDeleting && styles.rowDeleting]}
                activeOpacity={0.8}
                onPress={() => openScan(item)}
                onLongPress={() => confirmDelete(item)}
                disabled={isDeleting}
              >
                <View style={[styles.scoreBadge, { borderColor: glowColor(score, colors.textMuted) }]}>
                  <Text style={[styles.scoreNum, { color: glowColor(score, colors.textMuted) }]}>
                    {score != null ? Math.round(score) : '--'}
                  </Text>
                </View>
                <View style={inline.flex1}>
                  <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
                  <Text style={styles.rowMeta}>
                    {item.status === 'completed'
                      ? (isTongue
                          ? `Wellness ${item.overallWellnessScore != null ? Math.round(item.overallWellnessScore) : '--'}`
                          : `Glow ${item.glowScore != null ? Math.round(item.glowScore) : '--'} · Wellness ${item.overallWellnessScore != null ? Math.round(item.overallWellnessScore) : '--'}`)
                      : item.status}
                  </Text>
                </View>
                {/* Long-press still works, but it was the only way to delete and
                    nothing on screen said so — a visible button is discoverable. */}
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.textMuted} style={styles.deleteBtn} />
                ) : (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => confirmDelete(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${describeScan(item)}`}
                  >
                    <MCIcon name="trash-can-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
                <MCIcon name="chevron-right" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })}
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
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabBtnOn: { backgroundColor: GLOW },
  tabText: { fontSize: 13.5, fontWeight: '700', color: colors.textSecondary },
  tabTextOn: { color: colors.white },

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
  rowDeleting: { opacity: 0.5 },
  deleteBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
});

// Literal-only styles that used to sit inline in the JSX.
const inline = StyleSheet.create({
  flex1: { flex: 1 },
  p16_pb40: { padding: 16, paddingBottom: 40 },
});
