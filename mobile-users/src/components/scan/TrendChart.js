import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg';
import { COLORS } from '../../constants/theme';

/**
 * Lightweight line chart for a scan metric over time (no chart lib).
 * Props:
 *   points  - [{ date, value }] oldest→newest
 *   title   - section label
 *   color   - line colour (default brand primary)
 *   dotColor(value) - optional per-point colour fn
 */
const TrendChart = ({ points = [], title, color = COLORS.primary, dotColor }) => {
  const values = points.map(p => p.value).filter(v => v != null);
  if (values.length < 2) {
    return (
      <View style={styles.card}>
        {!!title && <Text style={styles.title}>{title}</Text>}
        <Text style={styles.empty}>Scan at least twice to see your trend.</Text>
      </View>
    );
  }

  const W = 300;
  const H = 110;
  const pad = 12;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (values.length - 1);
  const coords = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / span) * (H - pad * 2);
    return [x, y];
  });
  const polyline = coords.map(c => c.join(',')).join(' ');

  return (
    <View style={styles.card}>
      {!!title && <Text style={styles.title}>{title}</Text>}
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <SvgLine x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={COLORS.border} strokeWidth={1} />
        <Polyline points={polyline} fill="none" stroke={color} strokeWidth={2.5} />
        {coords.map((c, i) => (
          <Circle key={i} cx={c[0]} cy={c[1]} r={3.5} fill={dotColor ? dotColor(values[i]) : color} />
        ))}
      </Svg>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>Low {Math.round(min)}</Text>
        <Text style={styles.rangeText}>High {Math.round(max)}</Text>
      </View>
    </View>
  );
};

export default TrendChart;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 },
  empty: { fontSize: 13, color: COLORS.textMuted, paddingVertical: 14, textAlign: 'center' },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rangeText: { fontSize: 11, color: COLORS.textMuted },
});
