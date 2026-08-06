import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import useTheme from '../hooks/useTheme';

const TICKS = [0, 2, 4, 6, 8, 10];
// Where the thumb rests before the user has answered.
const NEUTRAL = 5;

/**
 * 0–10 pain slider shared by every before/after therapy prompt.
 *
 * `value` is a number, or null when nothing has been picked yet — the thumb then
 * sits at the midpoint in a muted tint rather than claiming a score nobody gave,
 * so "skipped" stays distinguishable from "answered 5". `onChange` gets the next
 * number.
 */
export default function PainScale({ value, onChange, label = 'Pain level' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const selected = typeof value === 'number' ? value : null;
  const position = selected == null ? NEUTRAL : selected;
  const unset = selected == null;

  const trackWidthRef = useRef(0);
  const grantXRef = useRef(0);
  // The responder is built once, so it can't read `onChange` from the closure —
  // rebuilding it mid-drag would drop the gesture.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emitFor = useCallback(x => {
    const width = trackWidthRef.current || 1;
    onChangeRef.current(Math.min(10, Math.max(0, Math.round((x / width) * 10))));
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Claim the drag outright: these prompts live inside AppDialog, whose
        // ScrollView would otherwise read the sideways swipe as a scroll and
        // take the gesture away halfway through.
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: e => {
          grantXRef.current = e.nativeEvent.locationX;
          emitFor(grantXRef.current);
        },
        // Tracked as an offset from the grant point rather than by reading
        // locationX again: locationX is measured against whatever view is under
        // the finger, so dragging across the thumb makes the value jump.
        onPanResponderMove: (_e, gesture) => emitFor(grantXRef.current + gesture.dx),
      }),
    [emitFor],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}: {unset ? '—' : `${selected}/10`}
      </Text>

      {/* The track is only 6px tall, so the padded wrapper is what the finger
          actually lands on. Padding is vertical only, which keeps the touch x
          mapping 1:1 onto the track underneath. */}
      <View
        style={styles.touchArea}
        onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
        {...panResponder.panHandlers}
      >
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, unset && styles.fillUnset, { width: `${position * 10}%` }]} />
          <View style={[styles.thumb, unset && styles.thumbUnset, { left: `${position * 10}%` }]} />
        </View>
      </View>

      <View style={styles.ticks}>
        {TICKS.map(n => (
          <Text key={n} style={styles.tickText}>{n}</Text>
        ))}
      </View>
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
  touchArea: { paddingVertical: 14, justifyContent: 'center' },
  track: {
    height: 6,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    overflow: 'visible',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 12, backgroundColor: colors.primary },
  fillUnset: { backgroundColor: colors.border },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: -7,
    marginLeft: -10,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.primary,
    elevation: 4,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  thumbUnset: { borderColor: colors.border },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  tickText: { fontSize: 12, color: colors.textMuted },
});
