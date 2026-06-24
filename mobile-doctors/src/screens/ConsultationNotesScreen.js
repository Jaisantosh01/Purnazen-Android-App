import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import AddRecordMenu from '../components/AddRecordMenu';
import useConsultationStore from '../store/consultationStore';
import appointmentService from '../services/appointmentService';
import { showSuccess, showError } from '../utils/toast';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

// ─── Section config ──────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    storeKey: 'doctorNotes',
    label: 'Doctor Notes',
    singularLabel: 'Doctor Note',
    icon: 'note-text-outline',
    screen: 'DoctorNotesEditor',
    deleteAction: 'deleteDoctorNote',
  },
  {
    storeKey: 'diagnoses',
    label: 'Diagnoses',
    singularLabel: 'Diagnosis',
    icon: 'stethoscope',
    screen: 'DiagnosisEditor',
    deleteAction: 'deleteDiagnosis',
  },
  {
    storeKey: 'prescriptions',
    label: 'Prescriptions',
    singularLabel: 'Prescription',
    icon: 'pill',
    screen: 'PrescriptionEditor',
    deleteAction: 'deletePrescription',
  },
];

// ─── Helper: Format timestamp ──────────────────────────────────────────────────
const formatRecordTimestamp = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  
  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `Created ${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
  }
  
  // Format as: 24 Jun 2026 11:45 AM
  const day = date.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampmStr = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  return `${day} ${month} ${year} ${hours}:${minutes} ${ampmStr}`;
};

// ─── Section Header ──────────────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, count }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionIconWrap}>
      <MCIcon name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.sectionTitle}>{title} ({count})</Text>
  </View>
);

// ─── Record Card ─────────────────────────────────────────────────────────────────
const RecordCard = ({
  number,
  singularLabel,
  content,
  timestamp,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}) => (
  <View style={styles.recordCard}>
    <View style={styles.recordHeaderRow}>
      <TouchableOpacity
        style={styles.recordHeaderToggle}
        activeOpacity={0.7}
        onPress={onToggle}>
        <MCIcon
          name={isExpanded ? 'chevron-down' : 'chevron-right'}
          size={20}
          color={COLORS.textSecondary}
          style={styles.chevron}
        />
        <View style={styles.headerTextWrap}>
          <Text style={styles.recordNumber}>{singularLabel} #{number}</Text>
          <Text style={styles.recordTimestamp}>{timestamp}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerActionBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          onPress={onEdit}>
          <MCIcon name="pencil-outline" size={17} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerActionBtn}
          activeOpacity={0.6}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          onPress={onDelete}>
          <MCIcon name="delete-outline" size={17} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>

    {isExpanded && (
      <View style={styles.recordExpandedContent}>
        <Text style={styles.recordContent}>{content}</Text>
      </View>
    )}
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────────
const ConsultationNotesScreen = ({ route, navigation }) => {
  const { appointment } = route.params || {};
  const [showMenu, setShowMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState(null);

  // Store selectors
  const doctorNotes = useConsultationStore(s => s.doctorNotes);
  const diagnoses = useConsultationStore(s => s.diagnoses);
  const prescriptions = useConsultationStore(s => s.prescriptions);
  const reset = useConsultationStore(s => s.reset);
  const deleteDoctorNote = useConsultationStore(s => s.deleteDoctorNote);
  const deleteDiagnosis = useConsultationStore(s => s.deleteDiagnosis);
  const deletePrescription = useConsultationStore(s => s.deletePrescription);

  // Reset on first mount (new consultation)
  useEffect(() => {
    reset();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const storeArrays = { doctorNotes, diagnoses, prescriptions };
  const deleteActions = { deleteDoctorNote, deleteDiagnosis, deletePrescription };

  const totalRecords = doctorNotes.length + diagnoses.length + prescriptions.length;
  const hasRecords = totalRecords > 0;

  // Open editor for a NEW record
  const openNewEditor = (screenName) => {
    navigation.navigate(screenName, { appointment, mode: 'create' });
  };

  // Open editor to EDIT an existing record
  const openEditEditor = (screenName, recordId) => {
    navigation.navigate(screenName, { appointment, mode: 'edit', recordId });
  };

  // Confirm & delete a record
  const handleDelete = (deleteAction, singularLabel, recordId) => {
    Alert.alert(
      `Delete ${singularLabel}`,
      `Are you sure you want to delete this ${singularLabel.toLowerCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteActions[deleteAction](recordId),
        },
      ],
    );
  };

  // Complete consultation — collect all records
  const handleComplete = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await appointmentService.updateStatus(appointment.id, 'completed');
      showSuccess('Appointment marked as completed.');
      reset();
      navigation.popToTop();
    } catch (e) {
      showError(e?.message || 'Could not complete appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Consultation Notes"
        subtitle={appointment?.patientName || appointment?.userName || 'Patient'}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => setShowMenu(true)}>
            <MCIcon name="plus" size={24} color={COLORS.white} />
          </TouchableOpacity>
        }
      />

      {!hasRecords ? (
        /* ── Empty State ──────────────────────────────────────────────────── */
        <View style={styles.emptyWrap}>
          <TouchableOpacity
            style={styles.emptyIconWrap}
            activeOpacity={0.7}
            onPress={() => setShowMenu(true)}>
            <MCIcon name="plus" size={48} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.emptyTitle}>Add Clinical Record</Text>
          <Text style={styles.emptySubtitle}>
            Tap + to add Doctor Notes, Diagnosis, or Prescription
          </Text>
        </View>
      ) : (
        /* ── Records grouped by section ───────────────────────────────────── */
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {(() => {
            // Filter, map to lastUpdated, and sort active sections descending by latest record timestamp
            const activeSections = SECTIONS.filter(section => storeArrays[section.storeKey].length > 0)
              .map(section => {
                const records = storeArrays[section.storeKey];
                const timestamps = records.map(r => new Date(r.createdAt).getTime());
                const lastUpdated = Math.max(...timestamps);
                return { ...section, lastUpdated, records };
              })
              .sort((a, b) => b.lastUpdated - a.lastUpdated);

            return activeSections.map(section => {
              const records = section.records;
              // Sort records inside section newest first
              const sortedRecords = [...records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              return (
                <View key={section.storeKey} style={styles.sectionWrap}>
                  <SectionHeader
                    icon={section.icon}
                    title={section.label}
                    count={records.length}
                  />
                  {sortedRecords.map((record, idx) => (
                    <RecordCard
                      key={record.id}
                      number={sortedRecords.length - idx}
                      singularLabel={section.singularLabel}
                      content={record.content}
                      timestamp={formatRecordTimestamp(record.createdAt)}
                      isExpanded={expandedRecordId === record.id}
                      onToggle={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                      onEdit={() => openEditEditor(section.screen, record.id)}
                      onDelete={() =>
                        handleDelete(section.deleteAction, section.singularLabel, record.id)
                      }
                    />
                  ))}
                </View>
              );
            });
          })()}

          {/* Complete Button */}
          <TouchableOpacity
            style={[styles.completeBtn, submitting && styles.btnDisabled]}
            activeOpacity={0.85}
            disabled={submitting}
            onPress={handleComplete}>
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <MCIcon name="checkbox-marked-circle-outline" size={20} color={COLORS.white} />
            )}
            <Text style={styles.completeBtnText}>
              {submitting ? 'Completing…' : 'Complete Consultation'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      <AddRecordMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        onSelect={openNewEditor}
      />
    </View>
  );
};

export default ConsultationNotesScreen;

// ─── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, gap: SPACING.md },
  bottomSpacer: { height: 40 },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },

  // ── Section ─────────────────────────────────────────────────────────────────
  sectionWrap: { gap: SPACING.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, flex: 1 },

  // ── Record card ─────────────────────────────────────────────────────────────
  recordCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  recordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordHeaderToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  chevron: {
    marginRight: 2,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  recordNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  recordTimestamp: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingRight: SPACING.md,
  },
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordExpandedContent: {
    padding: SPACING.md,
    paddingTop: 0,
    paddingBottom: SPACING.md,
  },
  recordContent: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },

  // ── Complete button ─────────────────────────────────────────────────────────
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.success,
    marginTop: SPACING.sm,
  },
  completeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
});
