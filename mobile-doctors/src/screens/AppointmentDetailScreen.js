import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import appointmentService from '../services/appointmentService';

// ─── Status config (mirrors AppointmentsScreen) ────────────────────────────────
const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  booked:    { label: 'Booked',    bg: '#EFF6FF', text: '#1D4ED8', dot: '#2563EB' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

// ─── Helper: format ISO date ────────────────────────────────────────────────────
const formatDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Info Row Component ─────────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoItem}>
    <View style={styles.infoIconWrap}>
      <MCIcon name={icon} size={18} color={COLORS.primary} />
    </View>
    <View style={styles.infoTextWrap}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

// ─── Section Card Component ─────────────────────────────────────────────────────
const SectionCard = ({ title, icon, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <MCIcon name={icon} size={18} color={COLORS.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

// ─── Status Badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

// ─── Main Screen ────────────────────────────────────────────────────────────────
const AppointmentDetailScreen = ({ route, navigation }) => {
  const { appointment: initialAppointment } = route.params || {};
  const id = initialAppointment?.id;
  const [appointment, setAppointment] = useState(initialAppointment || null);
  const [loading, setLoading] = useState(!initialAppointment);
  const [error, setError] = useState(null);

  const fetchAppointmentDetails = useCallback(async () => {
    if (initialAppointment) {
        return;
    }
    if (!id) {
      setError('No appointment ID provided.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await appointmentService.detail(id);
      setAppointment(data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load appointment details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!initialAppointment) {
        fetchAppointmentDetails();
    }
  }, [fetchAppointmentDetails, initialAppointment]);

  // ── Status Action Helpers ───────────────────────────────────────────────────
  const handleUpdateStatus = async (status) => {
    try {
      await appointmentService.updateStatus(id, status);
      await fetchAppointmentDetails();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not update appointment status.');
    }
  };

  const handleAccept = () => {
    Alert.alert(
      'Accept Appointment',
      `Accept appointment for ${appointment?.userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => handleUpdateStatus('booked') },
      ],
    );
  };

  const handleComplete = () => {
    Alert.alert(
      'Complete Appointment',
      `Mark appointment for ${appointment?.userName} as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Complete', onPress: () => handleUpdateStatus('completed') },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Appointment',
      `Cancel appointment for ${appointment?.userName}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => handleUpdateStatus('cancelled') },
      ],
    );
  };

  const handlePatientPress = () => {
    if (!appointment) return;
    navigation.navigate('PatientProfile', {
      patientId: appointment.userId,
      appointmentId: appointment.id,
      appointment: appointment,
    });
  };

  // ── Render content ──────────────────────────────────────────────────────────
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading appointment details…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={64} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Error Loading Details</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={fetchAppointmentDetails}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!appointment) {
      return (
        <View style={styles.center}>
          <MCIcon name="calendar-search" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Details Found</Text>
          <Text style={styles.emptySubtitle}>We couldn't find details for this appointment.</Text>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.8} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const apptStatus = appointment.status || 'pending';
    const isPending = apptStatus === 'pending';
    const isBooked = apptStatus === 'booked';

    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Patient Profile Summary Card ── */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.85}
          onPress={handlePatientPress}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              <MCIcon name="account" size={36} color={COLORS.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.patientName}>
                {appointment.userName || 'Unknown Patient'}
              </Text>
              <View style={styles.profileMeta}>
                <View style={styles.metaPill}>
                  <MCIcon name="calendar-account" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.metaPillText}>
                    {appointment.userAge ? `${appointment.userAge} yrs` : 'Age N/A'}
                  </Text>
                </View>
                <View style={styles.metaPill}>
                  <MCIcon name="gender-male-female" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.metaPillText}>
                    {appointment.userGender || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
            <StatusBadge status={apptStatus} />
          </View>

          <View style={styles.viewProfileRow}>
            <Text style={styles.viewProfileText}>View Patient Profile & Medical History</Text>
            <MCIcon name="chevron-right" size={16} color={COLORS.primary} />
          </View>
        </TouchableOpacity>

        {/* ── Appointment Information ── */}
        <SectionCard title="Appointment Details" icon="calendar-text">
          <InfoRow
            icon="text-box-outline"
            label="Reason for Visit"
            value={appointment.userDescription || 'No reason provided'}
          />
          <InfoRow
            icon="calendar-clock"
            label="Date & Time"
            value={`${formatDate(appointment.date)}  •  ${appointment.time || '—'}${appointment.endTime ? ` – ${appointment.endTime}` : ''}`}
          />
          <InfoRow
            icon="stethoscope"
            label="Consultation Type"
            value={appointment.consultationType}
          />
          <InfoRow
            icon="history"
            label="Previous Visits"
            value={appointment.previousVisitsCount != null ? String(appointment.previousVisitsCount) : '0'}
          />
        </SectionCard>

        {/* ── Status Actions ── */}
        {(isPending || isBooked) && (
          <View style={styles.actionBlock}>
            {isPending && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn]}
                activeOpacity={0.8}
                onPress={handleAccept}>
                <MCIcon name="check" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.acceptBtnText}>Accept Appointment</Text>
              </TouchableOpacity>
            )}

            {isBooked && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.completeBtn]}
                activeOpacity={0.8}
                onPress={handleComplete}>
                <MCIcon name="check-decagram" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.completeBtnText}>Mark as Completed</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              activeOpacity={0.8}
              onPress={handleCancel}>
              <MCIcon name="close-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Appointment Details"
        subtitle={appointment?.reference}
        onBack={() => navigation.goBack()}
      />
      {renderContent()}
    </View>
  );
};

export default AppointmentDetailScreen;

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, gap: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
  stateText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  bottomSpacer: { height: 40 },

  // ── Profile Card ──
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1, gap: 4 },
  patientName: { fontSize: 16.5, fontWeight: '800', color: COLORS.textPrimary },
  profileMeta: { flexDirection: 'row', gap: SPACING.sm },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaPillText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  viewProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewProfileText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ── Status Badge ──
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // ── Section Card ──
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },

  // ── Info Items ──
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },

  // ── Action Buttons Block ──
  actionBlock: {
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  acceptBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  completeBtn: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  completeBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderColor: COLORS.danger,
  },
  cancelBtnText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 15,
  },

  // ── Error/Empty States ──
  errorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  errorSubtitle: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.sm },
  retryBtn: { paddingHorizontal: SPACING.xl, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.sm },
  backBtn: { paddingHorizontal: SPACING.xl, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill },
  backBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});
