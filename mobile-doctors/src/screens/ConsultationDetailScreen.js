import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import appointmentService from '../services/appointmentService';

const DetailSection = ({ icon, title, content }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <MCIcon name={icon} size={18} color={colors.primary} style={styles.sectionIcon} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionDivider} />
    <Text style={styles.sectionContent}>{content || 'No records entered.'}</Text>
  </View>
  );
};

const STATUS_CONFIG = {
  Completed: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  Pending: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
};

const ConsultationDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { consultationId, patientName } = route.params || {};
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentService.detail(consultationId);
      setConsultation(data);
    } catch (err) {
      setError(err?.message || 'Failed to load consultation details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (consultationId) {
      fetchDetail();
    }
  }, [consultationId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Consultation Details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !consultation) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Consultation Details" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={colors.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error || 'No consultation data found.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDetail}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const time = consultation.time || 'N/A';
  const visitType = consultation.visitType || consultation.consultationType || 'N/A';
  const chiefComplaint = consultation.userDescription || 'N/A';
  const attachments = []; // TODO: Attachments are not yet linked to appointments in the backend DB
  const statusKey = consultation.status && consultation.status.toLowerCase() === 'completed' ? 'Completed' : 'Pending';
  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.Pending;

  const handleAttachmentsPress = () => {
    showAlert(
      'Attachments',
      `This consultation has ${attachments.length} attachment(s).`
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Consultation Details"
        subtitle={patientName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View>
              <Text style={styles.infoLabel}>Patient Name</Text>
              <Text style={styles.infoValue}>{patientName}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
              <Text style={[styles.badgeText, { color: statusCfg.text }]}>{consultation.status}</Text>
            </View>
          </View>

          <View style={styles.infoDivider} />

          {/* Quick Meta Data Grid */}
          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <MCIcon name="calendar-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
              <View>
                <Text style={styles.gridLabel}>Date</Text>
                <Text style={styles.gridValue}>{consultation.date}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <MCIcon name="clock-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
              <View>
                <Text style={styles.gridLabel}>Time</Text>
                <Text style={styles.gridValue}>{time}</Text>
              </View>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <MCIcon name="hospital-building" size={16} color={colors.textSecondary} style={styles.metaIcon} />
              <View>
                <Text style={styles.gridLabel}>Visit Type</Text>
                <Text style={styles.gridValue}>{visitType}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <MCIcon name="clipboard-text-outline" size={16} color={colors.textSecondary} style={styles.metaIcon} />
              <View>
                <Text style={styles.gridLabel}>Consultation</Text>
                <Text style={styles.gridValue} numberOfLines={1}>{consultation.reference}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Chief Complaint Section */}
        <DetailSection
          icon="alert-circle-outline"
          title="Chief Complaint"
          content={chiefComplaint}
        />

        {/* Diagnosis Section */}
        <DetailSection
          icon="stethoscope"
          title="Diagnosis"
          content="N/A" // TODO: Diagnosis table or field does not exist in backend DB
        />

        {/* Prescription Section */}
        <DetailSection
          icon="pill"
          title="Prescriptions"
          content="N/A" // TODO: Prescription table or field does not exist in backend DB
        />

        {/* Doctor Notes Section */}
        <DetailSection
          icon="note-text-outline"
          title="Doctor Notes"
          content={consultation.doctorDescription || 'N/A'}
        />

        {/* Attachments Button */}
        {attachments.length > 0 && (
          <TouchableOpacity
            style={styles.attachmentsBtn}
            activeOpacity={0.85}
            onPress={handleAttachmentsPress}>
            <MCIcon name="paperclip" size={18} color={colors.primary} style={styles.attachmentsIcon} />
            <Text style={styles.attachmentsBtnText}>
              View Attachments ({attachments.length})
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

export default ConsultationDetailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const makeStyles = colors =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  errorText: { fontSize: 14.5, color: colors.textSecondary, fontWeight: '500', textAlign: 'center', marginBottom: SPACING.md },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.md },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 13.5 },

  // Info Card
  infoCard: {
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
    gap: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 2,
  },

  // Grid Info Rows
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  gridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  gridLabel: {
    fontSize: 9.5,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  gridValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 1,
  },
  metaIcon: {
    marginRight: SPACING.sm,
  },

  // Badge Styling
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },

  // Section Cards
  sectionCard: {
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: SPACING.sm,
  },
  sectionContent: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    fontWeight: '500',
  },
  attachmentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    marginTop: SPACING.sm,
  },
  attachmentsIcon: {
    marginRight: SPACING.sm,
  },
  attachmentsBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
