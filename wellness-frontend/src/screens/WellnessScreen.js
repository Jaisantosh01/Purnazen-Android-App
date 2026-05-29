import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { WELLNESS_STATS, WELLNESS_PROGRAMS } from '../data/wellnessData';

const LEVEL_COLORS = {
  'Beginner':     { bg: '#e8f5e9', text: '#2e7d32' },
  'All levels':   { bg: '#e3f2fd', text: '#1565c0' },
  'Intermediate': { bg: '#fff3e0', text: '#e65100' },
};

const STATS = [
  { icon: 'target',      value: WELLNESS_STATS.sessions, label: 'Sessions' },
  { icon: 'timer-outline', value: WELLNESS_STATS.minutes,  label: 'Minutes'  },
  { icon: 'fire',        value: WELLNESS_STATS.streak,   label: 'Streak'   },
];

const WellnessScreen = ({ navigation }) => {
  const handleProgram = (program) => {
    if (program.sessionKey) {
      navigation.navigate('SessionScreen', { sessionKey: program.sessionKey });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#7C3AED" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wellness</Text>
          <Text style={styles.headerSubtitle}>Daily routines for a healthier you</Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {STATS.map((stat, i) => (
              <View key={i} style={[styles.statBox, i < STATS.length - 1 && styles.statBorder]}>
                <MCIcon name={stat.icon} size={26} color="#fff" />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Programs ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Programs</Text>
            <View style={styles.popularBadge}>
              <MCIcon name="trending-up" size={13} color="#1FA77A" />
              <Text style={styles.popularText}> Popular</Text>
            </View>
          </View>

          {WELLNESS_PROGRAMS.map((program) => {
            const level = LEVEL_COLORS[program.level] || { bg: '#f3f4f6', text: '#6b7280' };
            return (
              <TouchableOpacity
                key={program.id}
                style={styles.programCard}
                activeOpacity={0.85}
                onPress={() => handleProgram(program)}
              >
                {/* Icon */}
                <View style={[styles.iconCircle, { backgroundColor: program.iconBg }]}>
                  <MCIcon name={program.icon} size={28} color={program.iconColor} />
                </View>

                {/* Info */}
                <View style={styles.programInfo}>
                  <Text style={styles.programTitle}>{program.title}</Text>
                  <Text style={styles.programSubtitle}>{program.subtitle}</Text>

                  {/* Meta */}
                  <View style={styles.metaRow}>
                    <MCIcon name="clock-outline" size={12} color="#9ca3af" />
                    <Text style={styles.metaDuration}> {program.duration}</Text>
                    <View style={[styles.levelBadge, { backgroundColor: level.bg }]}>
                      <Text style={[styles.levelText, { color: level.text }]}>{program.level}</Text>
                    </View>
                    <Text style={styles.metaCompleted}>{program.completed} completed</Text>
                  </View>
                </View>

                {/* Play */}
                <TouchableOpacity
                  style={styles.playBtn}
                  activeOpacity={0.8}
                  onPress={() => handleProgram(program)}
                >
                  <MCIcon name="play" size={14} color="#1FA77A" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

export default WellnessScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },

  // Header
  header: {
    backgroundColor: '#7C3AED',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 20,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  // Section
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0faf6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  popularText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1FA77A',
  },

  // Program Cards
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  programInfo: {
    flex: 1,
  },
  programTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  programSubtitle: {
    fontSize: 12,
    color: '#1FA77A',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaDuration: {
    fontSize: 12,
    color: '#9ca3af',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metaCompleted: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Play Button
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e8f8f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
