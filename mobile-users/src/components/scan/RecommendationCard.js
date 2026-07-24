import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../../constants/theme';

const TYPE_CONFIG = {
  routine:     { icon: 'spa-outline',        color: '#C850C0', bg: '#fdf4ff' },
  face_yoga:   { icon: 'meditation',         color: '#7c3aed', bg: '#f5f3ff' },
  wellness_tip:{ icon: 'lightbulb-outline',  color: '#0ea5e9', bg: '#f0f9ff' },
  video:       { icon: 'play-circle-outline',color: '#16a34a', bg: '#f0fdf4' },
};

const RecommendationCard = ({ item, onPressRoutine }) => {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.wellness_tip;

  // Collapse long descriptions to 2 lines with a "Read more" toggle. The first
  // layout runs unconstrained so we learn the true line count, then we clamp.
  const [expanded, setExpanded] = useState(false);
  const [fullLines, setFullLines] = useState(null);
  const truncatable = fullLines != null && fullLines > 2;

  return (
    <View style={[styles.card, { borderLeftColor: config.color }]}>
      <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
        <MCIcon name={config.icon} size={20} color={config.color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{item.title}</Text>
        {!!item.description && (
          <>
            <Text
              style={styles.description}
              numberOfLines={fullLines == null ? undefined : (expanded ? undefined : 2)}
              onTextLayout={fullLines == null ? (e => setFullLines(e.nativeEvent.lines.length)) : undefined}
            >
              {item.description}
            </Text>
            {truncatable && (
              <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[styles.readMore, { color: config.color }]}>
                  {expanded ? 'Read less' : 'Read more'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {item.routineKey && onPressRoutine && (
          <TouchableOpacity
            style={styles.routineBtn}
            onPress={() => onPressRoutine(item.routineKey)}
            activeOpacity={0.7}
          >
            <Text style={[styles.routineBtnText, { color: config.color }]}>
              Start Routine
            </Text>
            <MCIcon name="arrow-right" size={13} color={config.color} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default RecommendationCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
  readMore: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  routineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 3,
  },
  routineBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
