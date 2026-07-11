import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import patientService from '../services/patientService';

const STATUS_CONFIG = {
  Completed: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  Pending: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
};

// ─── Timeline Item Component ──────────────────────────────────────────────────
const TimelineItem = ({
  item,
  isFirst,
  isLast,
  onPress,
  onDiagnosisPress,
  onPrescriptionPress,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Make status formatting case insensitive matching status config key
  const normalizedStatus = item.status && item.status.toLowerCase() === 'completed' ? 'Completed' : 'Pending';
  const statusCfg = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.Pending;

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
            <Text style={styles.cardDate}>{item.date}</Text>
            <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
              <Text style={[styles.badgeText, { color: statusCfg.text }]}>{item.status}</Text>
            </View>
          </View>

          {/* Consultation Name */}
          <Text style={styles.cardTitle}>{item.visitType}</Text>

          {/* Quick Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => onDiagnosisPress(item)}>
              <MCIcon name="stethoscope" size={14} color={colors.primary} style={styles.actionIcon} />
              <Text style={styles.actionBtnText}>Diagnosis</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.7}
              onPress={() => onPrescriptionPress(item)}>
              <MCIcon name="pill" size={14} color={colors.primary} style={styles.actionIcon} />
              <Text style={styles.actionBtnText}>Prescription</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
const ConsultationHistoryScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      // Load patient details to show correct subtitle
      const patient = await patientService.detail(patientId);
      if (patient) {
        setPatientName(patient.name);
      }
      
      const data = await patientService.consultations(patientId);
      setHistory(data);
    } catch (err) {
      setError(err?.message || 'Failed to load consultation history.');
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

  const handleConsultationPress = (consultation) => {
    navigation.navigate('ConsultationDetail', {
      consultationId: consultation.id,
      patientName,
    });
  };

  const handleDiagnosisPress = (consultation) => {
    // TODO: Diagnosis field is currently not supported by the backend DB schema.
    showAlert(
      'Diagnosis',
      consultation.diagnosis && consultation.diagnosis !== 'N/A'
        ? consultation.diagnosis
        : 'N/A (No diagnosis field in current backend DB)'
    );
  };

  const handlePrescriptionPress = (consultation) => {
    // TODO: Prescription field is currently not supported by the backend DB schema.
    showAlert(
      'Prescription',
      consultation.prescription && consultation.prescription !== 'N/A'
        ? consultation.prescription
        : 'N/A (No prescription field in current backend DB)'
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Consultation History"
        subtitle={patientName}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={colors.danger} style={{ marginBottom: 12 }} />
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
              onPress={handleConsultationPress}
              onDiagnosisPress={handleDiagnosisPress}
              onPrescriptionPress={handlePrescriptionPress}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MCIcon name="clipboard-text-outline" size={60} color={colors.borderStrong} />
              <Text style={styles.emptyTitle}>No History Available</Text>
              <Text style={styles.emptySubtitle}>
                This patient has no recorded consultation history.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default ConsultationHistoryScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = colors =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.borderStrong,
  },
  invisibleLine: {
    backgroundColor: 'transparent',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cardCol: {
    flex: 1,
    paddingBottom: SPACING.lg,
    paddingLeft: SPACING.xs,
  },

  // Card Styling
  card: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    marginBottom: 6,
  },
  cardDate: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: SPACING.md,
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

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryFaint,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
  },
  actionIcon: {
    marginRight: 4,
  },
  actionBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
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
    color: colors.textPrimary,
    marginTop: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: 14.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontWeight: '500',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
});
