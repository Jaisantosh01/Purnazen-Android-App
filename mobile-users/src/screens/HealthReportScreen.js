/**
 * My Health Report — a read-only roll-up of everything Purnazen already knows
 * about the patient: the vitals and medical background they entered under
 * Settings → Edit Profile, their therapy totals, their appointment history and
 * the most recent face / tongue scan.
 *
 * Nothing here is a new record — `GET /users/me/health-report` aggregates
 * existing rows, so the screen is safe to pull-to-refresh at any time.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator, Share,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import healthReportService from '../services/healthReportService';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const DASH = '—';

const fmtDate = iso => {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

// A score is 0–100; round for display but keep 0 visible (it's a real value).
const fmtScore = v => (v == null ? DASH : `${Math.round(v)}`);

const HealthReportScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setReport(await healthReportService.getReport());
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onShare = () => {
    if (!report) return;
    const { patient, vitals, medical, therapy, appointments, latestFaceScan, latestTongueScan } = report;
    const lines = [
      `Purnazen health report — ${fmtDate(report.generatedAt)}`,
      '',
      'Patient',
      `Name: ${patient.name || DASH}`,
      `Age / Gender: ${patient.age ?? DASH} / ${patient.gender || DASH}`,
      `Blood group: ${patient.bloodGroup || DASH}`,
      `Height / Weight: ${vitals.heightCm ?? DASH} cm / ${vitals.weightKg ?? DASH} kg`,
      vitals.bmi != null ? `BMI: ${vitals.bmi} (${vitals.bmiBand})` : null,
      '',
      'Medical background',
      `Allergies: ${medical.allergies || DASH}`,
      `Conditions: ${medical.conditions || DASH}`,
      `Medication: ${medical.medications || DASH}`,
      '',
      `Therapy: ${therapy.completedSessions} sessions · ${therapy.totalMinutes} min`,
      `Appointments: ${appointments.completed} completed · ${appointments.upcoming} upcoming`,
      appointments.lastVisit ? `Last visit: ${fmtDate(appointments.lastVisit)}` : null,
    ];

    if (latestFaceScan) {
      lines.push(
        '',
        'Latest face scan',
        `Taken on: ${fmtDate(latestFaceScan.takenAt)}`,
        `Wellness score: ${fmtScore(latestFaceScan.wellnessScore)}`,
        `Hydration: ${fmtScore(latestFaceScan.hydrationScore)}`,
        `Glow: ${fmtScore(latestFaceScan.glowScore)}`,
        latestFaceScan.skinAge != null ? `Skin age: ${latestFaceScan.skinAge}` : null,
      );
    }

    if (latestTongueScan) {
      lines.push(
        '',
        'Latest tongue scan',
        `Taken on: ${fmtDate(latestTongueScan.takenAt)}`,
        `Tongue colour: ${latestTongueScan.tongueColour || DASH}`,
        `Coat colour: ${latestTongueScan.coatColour || DASH}`,
        `Coat thickness: ${latestTongueScan.coatThickness || DASH}`,
        `Moisture: ${latestTongueScan.moisture || DASH}`,
        `Shape: ${latestTongueScan.shape || DASH}`,
      );
    }

    lines.push('', 'Generated with Purnazen. Not a medical diagnosis.');
    Share.share({ message: lines.filter(Boolean).join('\n') }).catch(() => {});
  };

  const Section = ({ icon, title, children, action }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <MCIcon name={icon} size={16} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );

  const Row = ({ label, value, last }) => (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={3}>{value || DASH}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="My Health Report" variant="light" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateText}>Building your report…</Text>
        </View>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="My Health Report" variant="light" />
        <View style={styles.centered}>
          <MCIcon name="alert-circle-outline" size={44} color={colors.danger} />
          <Text style={styles.stateTitle}>Couldn’t load your report</Text>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const { patient, vitals, medical, therapy, appointments, latestFaceScan, latestTongueScan } = report;
  const hasMedical = medical.allergies || medical.conditions || medical.medications;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="My Health Report"
        subtitle={`Generated ${fmtDate(report.generatedAt)}`}
        variant="light"
        right={(
          <TouchableOpacity onPress={onShare} hitSlop={HIT} activeOpacity={0.7}>
            {/* variant="light" paints the header on colors.surface, so the icon
                takes the page foreground rather than headerText (white). */}
            <MCIcon name="share-variant-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* ── Vitals strip ── */}
        <View style={styles.vitalsRow}>
          {[
            { icon: 'water', label: 'Blood', value: patient.bloodGroup },
            { icon: 'human-male-height', label: 'Height', value: vitals.heightCm ? `${vitals.heightCm} cm` : null },
            { icon: 'scale-bathroom', label: 'Weight', value: vitals.weightKg ? `${vitals.weightKg} kg` : null },
            { icon: 'heart-pulse', label: vitals.bmiBand || 'BMI', value: vitals.bmi != null ? `${vitals.bmi}` : null },
          ].map(v => (
            <View key={v.label} style={styles.vitalTile}>
              <MCIcon name={v.icon} size={18} color={colors.primary} />
              <Text style={styles.vitalValue}>{v.value || DASH}</Text>
              <Text style={styles.vitalLabel} numberOfLines={1}>{v.label}</Text>
            </View>
          ))}
        </View>

        {vitals.bmi == null && (
          <Text style={styles.hint}>
            Add your height and weight under Settings → Edit Profile to see your BMI here.
          </Text>
        )}

        <Section icon="account-outline" title="PATIENT">
          <Row label="Name" value={patient.name} />
          <Row label="Age" value={patient.age != null ? `${patient.age}` : null} />
          <Row label="Gender" value={patient.gender} last />
        </Section>

        <Section icon="clipboard-pulse-outline" title="MEDICAL BACKGROUND">
          {hasMedical ? (
            <>
              <Row label="Allergies" value={medical.allergies} />
              <Row label="Conditions" value={medical.conditions} />
              <Row label="Medication" value={medical.medications} last />
            </>
          ) : (
            <Text style={styles.emptyNote}>
              Nothing recorded yet. Add it under Settings → Edit Profile so your doctor can see it.
            </Text>
          )}
        </Section>

        <Section icon="history" title="THERAPY">
          <Row label="Completed sessions" value={`${therapy.completedSessions}`} />
          <Row label="Total minutes" value={`${therapy.totalMinutes}`} last />
        </Section>

        <Section icon="calendar-check-outline" title="CONSULTATIONS">
          <Row label="Completed" value={`${appointments.completed}`} />
          <Row label="Upcoming" value={`${appointments.upcoming}`} />
          <Row label="Last visit" value={fmtDate(appointments.lastVisit)} last />
        </Section>

        {latestFaceScan && (
          <Section icon="face-recognition" title="LATEST FACE SCAN">
            <Row label="Taken on" value={fmtDate(latestFaceScan.takenAt)} />
            <Row label="Wellness score" value={fmtScore(latestFaceScan.wellnessScore)} />
            <Row label="Hydration" value={fmtScore(latestFaceScan.hydrationScore)} />
            <Row label="Glow" value={fmtScore(latestFaceScan.glowScore)} />
            <Row label="Skin age" value={latestFaceScan.skinAge != null ? `${latestFaceScan.skinAge}` : null} last />
          </Section>
        )}

        {latestTongueScan && (
          <Section icon="emoticon-tongue-outline" title="LATEST TONGUE SCAN">
            <Row label="Taken on" value={fmtDate(latestTongueScan.takenAt)} />
            <Row label="Tongue colour" value={latestTongueScan.tongueColour} />
            <Row label="Coat colour" value={latestTongueScan.coatColour} />
            <Row label="Coat thickness" value={latestTongueScan.coatThickness} />
            <Row label="Moisture" value={latestTongueScan.moisture} />
            <Row label="Shape" value={latestTongueScan.shape} last />
          </Section>
        )}

        <Text style={styles.disclaimer}>
          This summary is generated from your activity in Purnazen. It is not a medical
          diagnosis — always discuss it with your doctor.
        </Text>
      </ScrollView>
    </View>
  );
};

export default HealthReportScreen;

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  stateTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  stateText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    marginTop: 12, backgroundColor: colors.primary,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: colors.white },

  vitalsRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginTop: 16,
  },
  vitalTile: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: colors.card, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  vitalValue: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  vitalLabel: { fontSize: 10.5, color: colors.textMuted },

  hint: {
    marginHorizontal: 16, marginTop: 10,
    fontSize: 12, lineHeight: 17, color: colors.textMuted,
  },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: {
    flex: 1, fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.card, borderRadius: 14, paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 11, gap: 12,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontSize: 13, color: colors.textSecondary },
  rowValue: { flex: 1.2, fontSize: 13, fontWeight: '600', color: colors.textPrimary, textAlign: 'right' },
  emptyNote: { fontSize: 12.5, lineHeight: 18, color: colors.textMuted, paddingVertical: 14 },

  disclaimer: {
    marginHorizontal: 16, marginTop: 22,
    fontSize: 11.5, lineHeight: 17, color: colors.textMuted, textAlign: 'center',
  },
});
