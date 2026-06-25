import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

const METRIC_LABELS = {
  hydrationScore:    { label: 'Hydration',    higherIsBetter: true  },
  oilinessScore:     { label: 'Oiliness',     higherIsBetter: false },
  wrinkleScore:      { label: 'Wrinkles',      higherIsBetter: false },
  pigmentationScore: { label: 'Pigmentation',  higherIsBetter: false },
  darkCircleScore:   { label: 'Dark Circles',  higherIsBetter: false },
  poreScore:         { label: 'Pore Size',     higherIsBetter: false },
  elasticityScore:   { label: 'Elasticity',    higherIsBetter: true  },
  muscleToneScore:   { label: 'Muscle Tone',   higherIsBetter: true  },
  inflammationScore: { label: 'Inflammation',  higherIsBetter: false },
  glowScore:         { label: 'Glow Score',    higherIsBetter: true  },
  toxinIndicator:    { label: 'Toxin Load',    higherIsBetter: false },
};

function scoreColor(value, higherIsBetter) {
  const good   = higherIsBetter ? value >= 65 : value <= 35;
  const medium = higherIsBetter ? value >= 40 : value <= 60;
  if (good)   return '#22c55e';
  if (medium) return '#f59e0b';
  return '#ef4444';
}

const MetricScoreRow = ({ metricKey, value }) => {
  if (value === null || value === undefined) return null;

  const meta = METRIC_LABELS[metricKey] || { label: metricKey, higherIsBetter: true };
  const color = scoreColor(value, meta.higherIsBetter);
  const barWidth = `${Math.min(Math.max(value, 0), 100)}%`;

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{meta.label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: barWidth, backgroundColor: color }]} />
      </View>
      <Text style={[styles.score, { color }]}>{Math.round(value)}</Text>
    </View>
  );
};

export default MetricScoreRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  label: {
    width: 110,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceMuted || '#f1f5f9',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  score: {
    width: 32,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },
});
