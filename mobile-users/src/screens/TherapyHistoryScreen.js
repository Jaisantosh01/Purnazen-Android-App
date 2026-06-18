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
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import therapyService from '../services/therapyService';
import { COLORS } from '../constants/theme';

const EMPTY_STATS = { sessions: 0, minutes: 0 };

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

  const sessions = history?.sessions ?? [];
  // Calculate total sessions started and total duration
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + (parseInt(s.duration) || 0), 0);

  const navigateToSession = (session) => {
    if (session.type === 'wellness') {
      navigation.navigate('VideoPlayer', {
        groupId: session.groupId,
        groupTitle: session.groupTitle
      });
    } else if (session.type === 'quick_relief') {
      navigation.navigate('ReliefSession', {
        reliefId: session.groupId, // Assuming reliefId maps to groupId
        reliefTitle: session.groupTitle,
      });
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
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
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions Started</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalMinutes}</Text>
            <Text style={styles.statLabel}>Minutes Watched</Text>
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
            <TouchableOpacity
              key={session.id}
              style={[
                styles.sessionCard,
                { backgroundColor: COLORS.white },
                index < sessions.length - 1 && styles.sessionBorder,
              ]}
              onPress={() => navigateToSession(session)}
              activeOpacity={0.7}
            >
              {/* Header: Video Name + Progress */}
              <View style={styles.sessionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle}>{session.videoTitle}</Text>
                  <Text style={styles.groupTitleText}>{session.groupTitle}</Text>
                </View>
                <Text style={styles.progressText}>
                  {session.totalSessionsInGroup}/{session.totalVideosInGroup}
                </Text>
              </View>

              {/* Separator */}
              <View style={styles.separator} />

              {/* Footer: Status + Time */}
              <View style={styles.sessionFooter}>
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
                    {session.status}
                  </Text>
                </View>
                <View style={styles.timeContainer}>
                  <Text style={styles.timeText}>
                    {session.modifiedAt || session.createdAt
                      ? new Date(session.modifiedAt || session.createdAt).toLocaleString([], {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })
                      : ''}
                  </Text>
                  <MCIcon name="calendar-clock-outline" size={14} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
                </View>
              </View>
            </TouchableOpacity>
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
    backgroundColor: '#E8F5E9', // Light green
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
    gap: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderRadius: 14, // Rounded
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },

  // Session List
  sessionList: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sessionCard: {
    padding: 16,
    backgroundColor: COLORS.white, // White
    borderRadius: 14,
    marginBottom: 16,
    elevation: 2,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },

  // Session Header
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  groupTitleText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.surfaceMuted,
    marginVertical: 8,
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: '#E8F5E9',
  },
  statusCancelled: {
    backgroundColor: '#F5F5F5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextCompleted: {
    color: '#2E7D32',
  },
  statusTextCancelled: {
    color: '#616161',
  },
});
