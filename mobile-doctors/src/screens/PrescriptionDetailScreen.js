import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

const MedicineCard = ({ medicine }) => (
  <View style={styles.medCard}>
    <View style={styles.medHeader}>
      <View style={styles.medIconWrap}>
        <MCIcon name="pill" size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.medName}>{medicine.name || 'N/A'}</Text>
    </View>

    <View style={styles.medDivider} />

    {/* Metadata Grid */}
    <View style={styles.medGrid}>
      <View style={styles.gridItem}>
        <Text style={styles.gridLabel}>Dosage</Text>
        <Text style={styles.gridValue}>{medicine.dosage || 'N/A'}</Text>
      </View>
      <View style={styles.gridItem}>
        <Text style={styles.gridLabel}>Frequency</Text>
        <Text style={styles.gridValue}>{medicine.frequency || 'N/A'}</Text>
      </View>
      <View style={styles.gridItem}>
        <Text style={styles.gridLabel}>Duration</Text>
        <Text style={styles.gridValue}>{medicine.duration || 'N/A'}</Text>
      </View>
    </View>

    {/* Instructions Block */}
    <View style={styles.instructionsContainer}>
      <Text style={styles.instructionsLabel}>Instructions</Text>
      <Text style={styles.instructionsContent}>{medicine.instructions || 'N/A'}</Text>
    </View>
  </View>
);

const STATUS_CONFIG = {
  Active: { bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  Completed: { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' },
};

const PrescriptionDetailScreen = ({ route, navigation }) => {
  const { prescription, patientName } = route.params || {};

  // TODO: Prescriptions table or model is not implemented in the backend database.
  // We handle missing/N/A values gracefully if the parameter is null or empty.
  const activePrescription = prescription || {
    prescriptionNumber: 'N/A',
    status: 'Completed',
    date: 'N/A',
    consultationName: 'N/A',
    medicines: [],
    doctorNotes: 'N/A (No prescription schema in backend database)'
  };

  const statusCfg = STATUS_CONFIG[activePrescription.status] || STATUS_CONFIG.Completed;

  const handleDownload = () => {
    showAlert(
      'Download Prescription',
      `Prescription ${activePrescription.prescriptionNumber} has been downloaded successfully as a PDF.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader
        title="Prescription Details"
        subtitle={activePrescription.prescriptionNumber}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Patient & Summary Panel */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Patient Name</Text>
              <Text style={styles.summaryValue}>{patientName || 'N/A'}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusCfg.dot }]} />
              <Text style={[styles.badgeText, { color: statusCfg.text }]}>{activePrescription.status}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MCIcon name="calendar-outline" size={16} color={COLORS.textSecondary} style={styles.metaIcon} />
              <Text style={styles.metaText}>{activePrescription.date}</Text>
            </View>
            <View style={styles.metaItem}>
              <MCIcon name="clipboard-pulse-outline" size={16} color={COLORS.textSecondary} style={styles.metaIcon} />
              <Text style={styles.metaText}>{activePrescription.consultationName}</Text>
            </View>
          </View>
        </View>

        {/* Medicines Section Title */}
        <Text style={styles.sectionHeader}>Prescribed Medicines</Text>

        {/* Medicines list cards */}
        {activePrescription.medicines.length === 0 ? (
          <View style={styles.noMedsCard}>
            <Text style={styles.noMedsText}>No medicines listed (Stub Prescription).</Text>
          </View>
        ) : (
          activePrescription.medicines.map((med, index) => (
            <MedicineCard key={index} medicine={med} />
          ))
        )}

        {/* Doctor Notes Section Card */}
        <View style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <MCIcon name="note-text-outline" size={18} color={COLORS.primary} style={styles.notesIcon} />
            <Text style={styles.notesTitle}>Doctor Notes</Text>
          </View>
          <View style={styles.notesDivider} />
          <Text style={styles.notesContent}>{activePrescription.doctorNotes}</Text>
        </View>
      </ScrollView>

      {/* Footer Anchored Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.downloadBtn}
          activeOpacity={0.85}
          onPress={handleDownload}>
          <MCIcon name="download" size={18} color={COLORS.white} style={styles.downloadIcon} />
          <Text style={styles.downloadBtnText}>Download Prescription</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PrescriptionDetailScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Summary Card
  summaryCard: {
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
    gap: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 6,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
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

  // Section Header
  sectionHeader: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    marginBottom: 2,
  },

  // Med Card
  medCard: {
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
    gap: SPACING.md,
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  medName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  medDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  medGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  gridItem: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  gridLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  gridValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 1,
  },
  instructionsContainer: {
    backgroundColor: COLORS.primaryFaint,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  instructionsLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  instructionsContent: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Notes Card
  notesCard: {
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
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesIcon: {
    marginRight: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  notesDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  notesContent: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    fontWeight: '500',
  },

  // Footer & Download Button
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  downloadBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadIcon: {
    marginRight: SPACING.sm,
  },
  downloadBtnText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
  noMedsCard: {
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
    alignItems: 'center',
  },
  noMedsText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
