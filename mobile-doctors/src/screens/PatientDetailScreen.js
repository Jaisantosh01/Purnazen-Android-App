import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import userService from '../services/userService';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', text: '#92400E' },
  booked:    { label: 'Booked',    bg: '#EFF6FF', text: '#1D4ED8' },
  completed: { label: 'Completed', bg: '#ECFDF5', text: '#065F46' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', text: '#991B1B' },
};

const formatDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
};

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoItem}>
    <View style={styles.infoIconWrap}>
      <MCIcon name={icon} size={18} color={COLORS.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);

const PatientDetailScreen = ({ route, navigation }) => {
  const { id, patient: passedPatient, appointments = [] } = route.params || {};
  const [patient, setPatient] = useState(passedPatient || null);
  // Only block on the network when we weren't handed a derived patient already.
  const [loading, setLoading] = useState(!passedPatient);
  const [error, setError] = useState(null);

  const fetchPatient = useCallback(async (showLoader = true) => {
    if (!id) { setError('No patient selected.'); setLoading(false); return; }
    if (showLoader && !passedPatient) setLoading(true);
    try {
      const data = await userService.getUser(id);
      if (data) {
        // Merge the full profile over the appointment-derived summary.
        setPatient(prev => ({ ...(prev || {}), ...data }));
      }
      setError(null);
    } catch (err) {
      // Keep the derived patient if we have one; only surface a hard error when
      // we have nothing to show.
      if (!passedPatient) setError(err?.message || 'Failed to load patient.');
    } finally {
      setLoading(false);
    }
  }, [id, passedPatient]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const name = patient?.full_name || patient?.name || 'Patient';
  const age = patient?.age ?? null;
  const gender = patient?.gender ?? null;
  const email = patient?.email ?? null;
  const phone = patient?.phone ?? null;

  const sortedAppts = [...appointments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Patient" onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </View>
    );
  }

  if (error && !patient) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Patient" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={56} color={COLORS.danger} />
          <Text style={styles.emptyTitle}>Couldn't load patient</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} activeOpacity={0.85} onPress={() => fetchPatient()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Patient Profile" subtitle={name} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <MCIcon name="account" size={42} color={COLORS.primary} />
          </View>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.metaRow}>
            {age != null && (
              <View style={styles.metaPill}>
                <MCIcon name="calendar-account" size={12} color={COLORS.textSecondary} />
                <Text style={styles.metaPillText}>{age} yrs</Text>
              </View>
            )}
            {gender && (
              <View style={styles.metaPill}>
                <MCIcon name="gender-male-female" size={12} color={COLORS.textSecondary} />
                <Text style={styles.metaPillText}>{gender}</Text>
              </View>
            )}
            <View style={styles.metaPill}>
              <MCIcon name="calendar-check" size={12} color={COLORS.textSecondary} />
              <Text style={styles.metaPillText}>{appointments.length} visit{appointments.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
        </View>

        {/* Contact */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MCIcon name="card-account-details-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Contact</Text>
          </View>
          <InfoRow icon="email-outline" label="Email" value={email} />
          <InfoRow icon="phone-outline" label="Phone" value={phone} />
        </View>

        {/* Visit history */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MCIcon name="history" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Visit history</Text>
            <Text style={styles.sectionCount}>{completedCount} completed</Text>
          </View>

          {sortedAppts.length === 0 ? (
            <Text style={styles.noHistory}>No appointment history available.</Text>
          ) : (
            sortedAppts.map((a, i) => (
              <View key={String(a.id ?? i)} style={[styles.historyRow, i > 0 && styles.historyDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyType} numberOfLines={1}>
                    {a.consultationType || a.visit_type || 'Consultation'}
                  </Text>
                  <Text style={styles.historyDate}>
                    {formatDate(a.date)}{a.time ? `  •  ${a.time}` : ''}
                  </Text>
                  {a.userDescription ? (
                    <Text style={styles.historyReason} numberOfLines={2}>{a.userDescription}</Text>
                  ) : null}
                </View>
                <StatusBadge status={a.status} />
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default PatientDetailScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.sm },
  scroll: { padding: SPACING.lg, gap: SPACING.md },

  emptyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  emptySubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: SPACING.sm },
  retryBtn: { paddingHorizontal: SPACING.xl, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  name: { fontSize: 19, fontWeight: '800', color: COLORS.textPrimary },
  metaRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap', justifyContent: 'center' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaPillText: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '600' },

  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
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
  sectionCount: { marginLeft: 'auto', fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },

  infoItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primaryFaint, alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },

  noHistory: { fontSize: 13, color: COLORS.textSecondary, paddingVertical: SPACING.sm },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingVertical: SPACING.md },
  historyDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  historyType: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  historyDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  historyReason: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 4, fontStyle: 'italic' },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
