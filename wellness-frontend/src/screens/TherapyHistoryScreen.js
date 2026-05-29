import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { THERAPY_STATS, THERAPY_SESSIONS } from '../data/therapyData';

const TherapyHistoryScreen = ({ navigation }) => {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Therapy History</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={styles.statValue}>{THERAPY_STATS.sessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={styles.statValue}>{THERAPY_STATS.minutes}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{THERAPY_STATS.avgRelief}</Text>
            <Text style={styles.statLabel}>Avg Relief</Text>
          </View>
        </View>

        {/* ── Session Cards ── */}
        <View style={styles.sessionList}>
          {THERAPY_SESSIONS.map((session, index) => (
            <View
              key={session.id}
              style={[
                styles.sessionCard,
                index < THERAPY_SESSIONS.length - 1 && styles.sessionBorder,
              ]}
            >
              {/* Title + Status */}
              <View style={styles.sessionHeader}>
                <Text style={styles.sessionTitle}>{session.title}</Text>
                <View style={[
                  styles.statusBadge,
                  session.status === 'Completed'
                    ? styles.statusCompleted
                    : styles.statusCancelled,
                ]}>
                  <Text style={[
                    styles.statusText,
                    session.status === 'Completed'
                      ? styles.statusTextCompleted
                      : styles.statusTextCancelled,
                  ]}>
                    {session.status === 'Completed' ? '✓ ' : ''}{session.status}
                  </Text>
                </View>
              </View>

              {/* Date + Duration */}
              <View style={styles.sessionMeta}>
                <Text style={styles.sessionMetaText}>📅 {session.date}</Text>
                <Text style={styles.sessionMetaText}>  🕐 {session.duration}</Text>
              </View>

              {/* Pain Progress — only for completed sessions */}
              {session.painBefore !== null && session.painAfter !== null && (
                <View style={styles.painSection}>
                  <Text style={styles.painLabel}>Pain Level Progress</Text>
                  <View style={styles.painRow}>
                    <View>
                      <Text style={styles.painSubLabel}>Before</Text>
                      <Text style={styles.painValue}>{session.painBefore}/10</Text>
                    </View>
                    <View style={styles.painDivider} />
                    <View style={styles.painAfter}>
                      <Text style={styles.painSubLabel}>After</Text>
                      <Text style={[styles.painValue, styles.painValueAfter]}>
                        {session.painAfter}/10
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default TherapyHistoryScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 14,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Session List
  sessionList: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 14,
    overflow: 'hidden',
  },
  sessionCard: {
    padding: 16,
    backgroundColor: '#fff',
  },
  sessionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },

  // Session Header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusCompleted: {
    backgroundColor: '#f0faf6',
  },
  statusCancelled: {
    backgroundColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextCompleted: {
    color: '#1FA77A',
  },
  statusTextCancelled: {
    color: '#9ca3af',
  },

  // Session Meta
  sessionMeta: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  sessionMetaText: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // Pain Progress
  painSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
  },
  painLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  painRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  painSubLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  painValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  painDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  painAfter: {
    alignItems: 'flex-end',
  },
  painValueAfter: {
    color: '#1FA77A',
  },
});