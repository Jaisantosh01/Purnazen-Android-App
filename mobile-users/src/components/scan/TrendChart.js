import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Polyline,
  Polygon,
  Circle,
  Line as SvgLine,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { COLORS } from '../../constants/theme';

/**
 * Informative line chart for a scan metric over time (no chart lib).
 *
 * Beyond the raw line it surfaces the headline number, the change vs the first
 * scan, a trend verdict (Improving / Declining / Steady), an average reference
 * line, value gridlines and the date range — so a glance answers "where am I,
 * and am I getting better?".
 *
 * Props:
 *   points          - [{ date, value }] oldest→newest
 *   title           - section label
 *   color           - accent colour (default brand primary)
 *   dotColor(value) - optional per-point colour fn
 *   colors          - theme palette (falls back to static light COLORS)
 *   unit            - optional value suffix (e.g. '' or '%')
 *   higherIsBetter  - whether an upward trend is good (default true)
 */
const TrendChart = ({
  points = [],
  title,
  color = COLORS.primary,
  dotColor,
  colors = COLORS,
  unit = '',
  higherIsBetter = true,
}) => {
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const values = points.map(p => p.value).filter(v => v != null);

  if (values.length < 2) {
    return (
      <View style={styles.card}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>Scan at least twice to see your trend.</Text>
        </View>
      </View>
    );
  }

  const W = 320;
  const H = 150;
  const padX = 30;
  const padTop = 14;
  const padBottom = 22;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const worse = higherIsBetter ? delta < 0 : delta > 0;
  const trendColor = delta === 0 ? colors.textMuted : improved ? '#22c55e' : '#ef4444';
  const verdict = delta === 0 ? 'Steady' : improved ? 'Improving' : 'Declining';
  const arrow = delta === 0 ? '→' : delta > 0 ? '▲' : '▼';

  // Pad the value axis a touch so the line never hugs the frame edges.
  const axisMin = min - span * 0.12;
  const axisMax = max + span * 0.12;
  const axisSpan = axisMax - axisMin || 1;

  const yFor = v => padTop + (1 - (v - axisMin) / axisSpan) * plotH;
  const stepX = plotW / (values.length - 1);
  const coords = values.map((v, i) => [padX + i * stepX, yFor(v)]);
  const polyline = coords.map(c => c.join(',')).join(' ');
  const area = `${padX},${padTop + plotH} ${polyline} ${padX + plotW},${padTop + plotH}`;

  const avgY = yFor(avg);
  const gradId = `grad-${title || 'metric'}`.replace(/\s+/g, '-');

  const fmtDate = iso => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        <View style={[styles.verdictPill, { backgroundColor: `${trendColor}1a` }]}>
          <Text style={[styles.verdictText, { color: trendColor }]}>
            {arrow} {verdict}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View>
          <Text style={styles.bigValue}>
            {Math.round(last)}
            <Text style={styles.unit}>{unit}</Text>
          </Text>
          <Text style={styles.bigLabel}>latest</Text>
        </View>
        <View style={styles.metaCol}>
          <Text style={[styles.deltaText, { color: trendColor }]}>
            {delta > 0 ? '+' : ''}{Math.round(delta)} vs first
          </Text>
          <Text style={styles.metaSub}>
            avg {Math.round(avg)} · {values.length} scans
          </Text>
        </View>
      </View>

      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.28" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* value gridlines: high / mid / low */}
        {[axisMax - axisSpan * 0.12, (min + max) / 2, axisMin + axisSpan * 0.12].map((v, i) => {
          const y = yFor(v);
          return (
            <React.Fragment key={i}>
              <SvgLine x1={padX} y1={y} x2={W - padX} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="2 4" />
              <SvgText x={padX - 6} y={y + 3} fontSize="9" fill={colors.textMuted} textAnchor="end">
                {Math.round(v)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* average reference line */}
        <SvgLine x1={padX} y1={avgY} x2={W - padX} y2={avgY} stroke={colors.textMuted} strokeWidth={1} strokeDasharray="5 4" opacity={0.5} />

        {/* area + line */}
        <Polygon points={area} fill={`url(#${gradId})`} />
        <Polyline points={polyline} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {coords.map((c, i) => {
          const isLast = i === coords.length - 1;
          const fill = dotColor ? dotColor(values[i]) : color;
          return (
            <Circle
              key={i}
              cx={c[0]}
              cy={c[1]}
              r={isLast ? 5 : 3}
              fill={isLast ? fill : colors.card}
              stroke={fill}
              strokeWidth={2}
            />
          );
        })}
      </Svg>

      <View style={styles.axisRow}>
        <Text style={styles.axisText}>{fmtDate(points[0]?.date)}</Text>
        <Text style={styles.axisText}>{fmtDate(points[points.length - 1]?.date)}</Text>
      </View>
    </View>
  );
};

export default TrendChart;

const makeStyles = colors =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    verdictPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    verdictText: { fontSize: 11.5, fontWeight: '800' },

    statsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
    bigValue: { fontSize: 30, fontWeight: '900', color: colors.textPrimary },
    unit: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
    bigLabel: { fontSize: 11, color: colors.textMuted, marginTop: -2 },
    metaCol: { alignItems: 'flex-end' },
    deltaText: { fontSize: 13, fontWeight: '800' },
    metaSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 2 },

    axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2, paddingHorizontal: 4 },
    axisText: { fontSize: 10.5, color: colors.textMuted },

    emptyWrap: { paddingVertical: 22, alignItems: 'center' },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  });
