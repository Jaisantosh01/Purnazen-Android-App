import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import therapyService from '../services/therapyService';
import { COLORS } from '../constants/theme';

const EMPTY_STATS = { sessions: 0, minutes: 0, avgRelief: 0 };

const TherapyHistoryScreen = ({ navigation }) => {
  const [history, setHistory]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await therapyService.getTherapyHistory();
      setHistory(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const stats = history?.stats ?? EMPTY_STATS;
  const sessions = history?.sessions ?? [];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

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

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading history...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>Failed to load history</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchHistory} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={styles.statValue}>{stats.sessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={[styles.statBox, styles.statBorder]}>
            <Text style={styles.statValue}>{stats.minutes}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.avgRelief}</Text>
            <Text style={styles.statLabel}>Avg Relief</Text>
          </View>
        </View>

        {/* ── Session Cards ── */}
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.stateTitle}>No sessions yet</Text>
            <Text style={styles.stateText}>
              Complete a wellness or relief session and it will show up here.
            </Text>
          </View>
        ) : (
        <View style={styles.sessionList}>
          {sessions.map((session, index) => (
            <View
              key={session.id}
              style={[
                styles.sessionCard,
                index < sessions.length - 1 && styles.sessionBorder,
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
        )}
      </ScrollView>
      )}
    </View>
  );
};

export default TherapyHistoryScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceMuted,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: COLORS.textPrimary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // Loading / error / empty states
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 8,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stateText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.surfaceMuted,
    borderRadius: 14,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: COLORS.white,
  },
  statBorder: {
    borderRightWidth: 1,
    borderRightColor: COLORS.surfaceMuted,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Session List
  sessionList: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceMuted,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sessionCard: {
    padding: 16,
    backgroundColor: COLORS.white,
  },
  sessionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceMuted,
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
    color: COLORS.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusCompleted: {
    backgroundColor: COLORS.primaryFaint,
  },
  statusCancelled: {
    backgroundColor: COLORS.surfaceMuted,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTextCompleted: {
    color: COLORS.primary,
  },
  statusTextCancelled: {
    color: COLORS.textMuted,
  },

  // Session Meta
  sessionMeta: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  sessionMetaText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // Pain Progress
  painSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
  },
  painLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  painRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  painSubLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  painValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  painDivider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  painAfter: {
    alignItems: 'flex-end',
  },
  painValueAfter: {
    color: COLORS.primary,
  },
});
