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
  ActivityIndicator, Share, Linking,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import healthReportService from '../services/healthReportService';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import { showAlert } from '../utils/alert';

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
  const [exporting, setExporting] = useState(false);

  // The PDF is rendered by the backend; the browser gets a 10-minute link so
  // the user can save or share it from there without a file-system module here.
  const onExportPdf = async () => {
    setExporting(true);
    try {
      const url = await healthReportService.exportPdfUrl();
      if (!url) throw new Error('No link returned');
      await Linking.openURL(url);
    } catch (err) {
      showAlert('Export failed', err.message || 'Could not prepare the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

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
      `Therapy: ${therapy.completedSessions} sessions · ${therapy.totalMinutes} min · ${therapy.streakDays ?? 0}-day streak`,
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
        <ScreenHeader title="My Health Report" variant="light" backBehavior="popToRoot" />
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
        <ScreenHeader title="My Health Report" variant="light" backBehavior="popToRoot" />
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
        backBehavior="popToRoot"
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
        contentContainerStyle={inline.pb32}
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

        {/* Export */}
        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportBtn} onPress={onExportPdf} disabled={exporting} activeOpacity={0.85}>
            {exporting
              ? <ActivityIndicator size="small" color={colors.white} />
              : <MCIcon name="file-pdf-box" size={18} color={colors.white} />}
            <Text style={styles.exportText}>{exporting ? 'Preparing…' : 'Export PDF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportGhost} onPress={onShare} activeOpacity={0.85}>
            <MCIcon name="share-variant-outline" size={18} color={colors.primary} />
            <Text style={styles.exportGhostText}>Share text</Text>
          </TouchableOpacity>
        </View>

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

        <Section icon="history" title="WELLNESS & THERAPY">
          <View style={styles.therapyStrip}>
            {[
              { value: therapy.completedSessions, label: 'sessions' },
              { value: therapy.totalMinutes, label: 'minutes' },
              { value: therapy.streakDays ?? 0, label: 'day streak' },
            ].map(x => (
              <View key={x.label} style={styles.therapyStat}>
                <Text style={styles.therapyValue}>{x.value}</Text>
                <Text style={styles.therapyLabel}>{x.label}</Text>
              </View>
            ))}
          </View>
          {(therapy.recent || []).map((run, i, arr) => (
            <View key={`${run.date}-${i}`} style={[styles.runRow, i < arr.length - 1 && styles.rowDivider]}>
              <View style={[styles.runDot, run.status === 'completed' ? styles.runDone : styles.runOpen]} />
              <View style={styles.flex}>
                <Text style={styles.runTitle} numberOfLines={1}>{run.title || 'Session'}</Text>
                <Text style={styles.runMeta}>
                  {fmtDate(run.date)} · {run.sessionType === 'relief' ? 'Quick Relief' : 'Wellness'}
                </Text>
              </View>
              <Text style={[styles.runStatus, run.status === 'completed' ? styles.runStatusDone : null]}>
                {run.status === 'completed' ? 'Done' : 'In progress'}
              </Text>
            </View>
          ))}
          {!(therapy.recent || []).length && (
            <Text style={styles.emptyNote}>No sessions yet. Start one from the Wellness tab.</Text>
          )}
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

        <Text style={styles.summaryNote}>
          This summary is generated from your activity in Purnazen.
        </Text>
        <MedicalDisclaimer />
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

  flex: { flex: 1 },
  exportRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 14 },
  exportBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 14,
  },
  exportText: { fontSize: 14, fontWeight: '700', color: colors.white },
  exportGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primaryLight, paddingVertical: 12, borderRadius: 14,
  },
  exportGhostText: { fontSize: 14, fontWeight: '700', color: colors.primary },

  therapyStrip: {
    flexDirection: 'row', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  therapyStat: { flex: 1, alignItems: 'center', gap: 2 },
  therapyValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  therapyLabel: { fontSize: 11, color: colors.textMuted },
  runRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  runDot: { width: 8, height: 8, borderRadius: 4 },
  runDone: { backgroundColor: colors.primary },
  runOpen: { backgroundColor: colors.warning },
  runTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  runMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  runStatus: { fontSize: 11.5, fontWeight: '700', color: colors.warning },
  runStatusDone: { color: colors.primary },

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

  summaryNote: {
    marginHorizontal: 16, marginTop: 22,
    fontSize: 11.5, lineHeight: 17, color: colors.textMuted, textAlign: 'center',
  },
});

// Literal-only styles that used to sit inline in the JSX.
const inline = StyleSheet.create({
  pb32: { paddingBottom: 32 },
});
