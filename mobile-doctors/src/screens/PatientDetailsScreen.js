import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import userService from '../services/userService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

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
const PatientDetailsScreen = ({ route, navigation }) => {
  const { userId, appointment } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState(null);
  const apptStatus = appointment?.status || 'pending';

  const fetchPatientDetails = useCallback(async () => {
    if (!userId) {
      setError('No patient ID provided.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUser(userId);
      setPatient(data || null);
    } catch (err) {
      setError(err?.message || 'Failed to load patient details.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPatientDetails();
  }, [fetchPatientDetails]);

  // ── Navigate to consultation notes (Step 2) ────────────────────────────────
  const handleNext = () => {
    navigation.navigate('ConsultationNotes', {
      appointment: { ...appointment, patientName: patient?.full_name },
    });
  };

  // ── Render content ──────────────────────────────────────────────────────────
  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading patient details…</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={64} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Error Loading Profile</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} activeOpacity={0.8} onPress={fetchPatientDetails}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!patient) {
      return (
        <View style={styles.center}>
          <MCIcon name="account-search-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Details Found</Text>
          <Text style={styles.emptySubtitle}>We couldn't find details for this patient.</Text>
          <TouchableOpacity style={styles.backBtn} activeOpacity={0.8} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const showNext = apptStatus === 'pending' || apptStatus === 'booked';

    return (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Patient Profile Card ─────────────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              <MCIcon name="account" size={42} color={COLORS.primary} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.patientName}>
                {patient.full_name || 'Unknown Patient'}
              </Text>
              <View style={styles.profileMeta}>
                <View style={styles.metaPill}>
                  <MCIcon name="calendar-account" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.metaPillText}>
                    {(appointment?.userAge ?? patient.age) ? `${appointment?.userAge ?? patient.age} yrs` : 'Age N/A'}
                  </Text>
                </View>
                <View style={styles.metaPill}>
                  <MCIcon name="gender-male-female" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.metaPillText}>
                    {appointment?.userGender ?? patient.gender ?? 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
            <StatusBadge status={apptStatus} />
          </View>

          {/* Contact row */}
          <View style={styles.contactRow}>
            <View style={styles.contactItem}>
              <MCIcon name="email-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.contactText} numberOfLines={1}>
                {patient.email || 'No email'}
              </Text>
            </View>
            <View style={styles.contactItem}>
              <MCIcon name="phone-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.contactText} numberOfLines={1}>
                {appointment?.userPhone ?? patient.phone ?? 'No phone'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Appointment Information ──────────────────────────────────────── */}
        {appointment && (
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
              value={appointment.previousVisitsCount != null ? String(appointment.previousVisitsCount) : 'N/A'}
            />
          </SectionCard>
        )}

        {/* ── Next Button ────────────────────────────────────────────────── */}
        {showNext && (
          <TouchableOpacity
            style={styles.nextBtn}
            activeOpacity={0.85}
            onPress={handleNext}>
            <Text style={styles.nextBtnText}>Next</Text>
            <MCIcon name="arrow-right" size={20} color={COLORS.white} />
          </TouchableOpacity>
        )}

        {/* Bottom spacer */}
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

export default PatientDetailsScreen;

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, gap: SPACING.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
  stateText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  bottomSpacer: { height: 40 },

  // ── Profile Card ────────────────────────────────────────────────────────────
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: { flex: 1, gap: 4 },
  patientName: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
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
  contactRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  contactItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactText: { fontSize: 12.5, color: COLORS.textSecondary, flex: 1 },

  // ── Status Badge ────────────────────────────────────────────────────────────
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

  // ── Section Card ────────────────────────────────────────────────────────────
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

  // ── Info Items ──────────────────────────────────────────────────────────────
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

  // ── Next Button ─────────────────────────────────────────────────────────────
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  nextBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  // ── Error/Empty States ──────────────────────────────────────────────────────
  errorTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  errorSubtitle: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.sm },
  retryBtn: { paddingHorizontal: SPACING.xl, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: SPACING.sm },
  backBtn: { paddingHorizontal: SPACING.xl, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill },
  backBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});
