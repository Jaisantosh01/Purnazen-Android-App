import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import patientService from '../services/patientService';

const STATUS_CONFIG = {
  Active: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  Completed: { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' },
};

// ─── Separation Component ────────────────────────────────────────────────────
const PrescriptionSeparator = () => <View style={styles.separator} />;

// ─── Timeline Item Component ──────────────────────────────────────────────────
const TimelineItem = ({ item, isFirst, isLast, onPress }) => {
  const normalizedStatus = item.status && item.status.toLowerCase() === 'active' ? 'Active' : 'Completed';
  const statusCfg = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.Completed;
  const medicinesCount = item.medicines ? item.medicines.length : 0;

  return (
    <View style={styles.row}>
      {/* Left Timeline Indicator Column */}
      <View style={styles.indicatorCol}>
        <View style={[styles.line, isFirst && styles.invisibleLine]} />
        <View style={styles.dot}>
          <View style={styles.dotInner} />
        </View>
        <View style={[styles.line, isLast && styles.invisibleLine]} />
      </View>

      {/* Right Consultation Card Column */}
      <View style={styles.cardCol}>
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.88}
          onPress={() => onPress(item)}>
          {/* Card Header (Date & Status Badge) */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardDate}>{item.date || 'N/A'}</Text>
            <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
              <Text style={[styles.badgeText, { color: statusCfg.text }]}>{item.status || 'Completed'}</Text>
            </View>
          </View>

          {/* Rx number */}
          <Text style={styles.rxNumber}>{item.prescriptionNumber || 'N/A'}</Text>

          {/* Consultation Name */}
          <Text style={styles.cardTitle}>{item.consultationName || 'N/A'}</Text>

          <View style={styles.divider} />

          {/* Row showing medicines count */}
          <View style={styles.medsCountRow}>
            <MCIcon name="pill" size={16} color={COLORS.primary} style={styles.medsIcon} />
            <Text style={styles.medsCountText}>
              {medicinesCount} Medicine{medicinesCount > 1 ? 's' : ''} Prescribed
            </Text>
            <MCIcon name="chevron-right" size={20} color={COLORS.textMuted} style={styles.chevronIcon} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
const PrescriptionHistoryScreen = ({ route, navigation }) => {
  const { patientId } = route.params || {};
  const [patientName, setPatientName] = useState('Patient');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const patient = await patientService.detail(patientId);
      if (patient) {
        setPatientName(patient.name);
      }
      // TODO: Prescriptions table or endpoint does not exist on the backend database.
      // Calling patientService.prescriptions(patientId) will return an empty list stub.
      const data = await patientService.prescriptions(patientId);
      setHistory(data);
    } catch (err) {
      setError(err?.message || 'Failed to load prescription history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchHistory();
    }
  }, [patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(false);
  };

  const handlePrescriptionPress = (prescription) => {
    navigation.navigate('PrescriptionDetail', {
      prescription,
      patientName,
    });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Prescription History"
        subtitle={patientName}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={COLORS.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchHistory()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <TimelineItem
              item={item}
              isFirst={index === 0}
              isLast={index === history.length - 1}
              onPress={handlePrescriptionPress}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={PrescriptionSeparator}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="file-document-outline" size={60} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No Prescriptions</Text>
              <Text style={styles.emptySubtitle}>
                This patient has no recorded prescriptions.
              </Text>
              {/* TODO: Add a note indicating database schema status */}
              <Text style={styles.todoStubText}>
                (Backend DB is missing prescription tables)
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default PrescriptionHistoryScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.lg, paddingBottom: 40 },

  // Timeline Row Layout
  row: {
    flexDirection: 'row',
  },
  indicatorCol: {
    width: 32,
    alignItems: 'center',
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.borderStrong,
  },
  invisibleLine: {
    backgroundColor: 'transparent',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  cardCol: {
    flex: 1,
    paddingBottom: SPACING.lg,
    paddingLeft: SPACING.xs,
  },

  // Card Styling
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  rxNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },

  // Badges
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Meds Row
  medsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medsIcon: {
    marginRight: 6,
  },
  medsCountText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  chevronIcon: {
    marginLeft: 4,
  },

  separator: {
    height: SPACING.sm,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  todoStubText: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 14.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
});
