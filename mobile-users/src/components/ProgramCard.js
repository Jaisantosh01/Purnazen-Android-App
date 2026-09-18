import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import { COLORS, RADIUS, SPACING } from '../constants/theme';
import { reliefCardColors } from '../utils/cardTheme';

// Wellness programs carry no colour of their own (relief cards do), so the
// grid cycles through a calm set; reliefCardColors composites them for dark.
export const PROGRAM_HUES = [
  { bg: '#EEE9FF', fg: '#6D4AFF' },
  { bg: '#E6F7EF', fg: '#0E9F6E' },
  { bg: '#FFEFE6', fg: '#E8702A' },
  { bg: '#E6F2FF', fg: '#2B7BD6' },
];

export const ProgressBar = ({ done = 0, total = 0, accent, light = false }) => (
  <View style={[styles.track, light && styles.trackLight]}>
    <View
      style={[
        styles.fill,
        light && styles.fillLight,
        accent && { backgroundColor: accent },
        { width: `${total > 0 ? Math.min(100, (done / total) * 100) : 0}%` },
      ]}
    />
  </View>
);

/**
 * ProgramCard — the tinted 2-up wellness tile used on the Wellness tab and in
 * Home's Wellness section, so the two can't drift apart.
 *
 * Props:
 *   program  { title, duration, icon, videoGroupId }
 *   index    position in the grid (picks the hue)
 *   done     completed runs (shows the "Done" chip when > 0)
 *   open     in-progress run { completedVideos, totalVideos } — shows a bar
 *   onPress
 */
export default function ProgramCard({ program, index = 0, done = 0, open = null, onPress }) {
  const { colors, isDark } = useTheme();
  const card = reliefCardColors({ ...PROGRAM_HUES[index % PROGRAM_HUES.length], colors, isDark });
  const ready = !!program.videoGroupId;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: card.background }, !ready && styles.cardSoon]}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${program.title}, ${ready ? program.duration : 'coming soon'}`}
    >
      <View style={styles.top}>
        <MCIcon name={program.icon || 'star-four-points-outline'} size={30} color={card.accent} />
        {done > 0 && (
          <View style={[styles.doneChip, { backgroundColor: card.accent }]}>
            <MCIcon name="check" size={11} color={COLORS.white} />
            <Text style={styles.doneChipText}>{done > 1 ? `×${done}` : 'Done'}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.title, { color: card.title }]} numberOfLines={2}>{program.title}</Text>
      <Text style={[styles.meta, { color: card.subtitle }]}>{ready ? program.duration : 'Coming soon'}</Text>

      {open ? (
        <View style={styles.progress}>
          <ProgressBar done={open.completedVideos} total={open.totalVideos} accent={card.accent} />
          <Text style={[styles.meta, { color: card.accent }]}>
            {open.completedVideos ?? 0}/{open.totalVideos ?? 0}
          </Text>
        </View>
      ) : (
        <View style={styles.footer}>
          <Text style={[styles.cta, { color: card.accent }]}>{ready ? 'Start' : 'Soon'}</Text>
          <MCIcon name={ready ? 'arrow-right' : 'clock-outline'} size={16} color={card.accent} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: 14,
    minHeight: 160,
    justifyContent: 'space-between',
  },
  cardSoon: { opacity: 0.6 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.sm },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  doneChipText: { fontSize: 10, fontWeight: '800', color: COLORS.white },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  meta: { fontSize: 12, fontVariant: ['tabular-nums'] },
  progress: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm },
  cta: { fontSize: 12, fontWeight: '700' },

  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden', flex: 1 },
  trackLight: { backgroundColor: 'rgba(255,255,255,0.25)' },
  fill: { height: 6, borderRadius: 3 },
  fillLight: { backgroundColor: COLORS.white },
});
