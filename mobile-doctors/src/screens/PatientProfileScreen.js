import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import patientService from '../services/patientService';

const MENU_ITEMS = [
  { id: 'history', title: 'Consultation History', icon: 'clipboard-text-clock-outline' },
  { id: 'face', title: 'Face Scan History', icon: 'face-recognition' },
  { id: 'tongue', title: 'Tongue Scan History', icon: 'camera-iris' },
  { id: 'prescriptions', title: 'Prescriptions', icon: 'pill' },
];

const PatientProfileScreen = ({ route, navigation }) => {
  const { id, patientId, appointment } = route.params || {};
  const activePatientId = patientId || id;

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatient = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await patientService.detail(activePatientId);
      setPatient(data);
    } catch (err) {
      setError(err?.message || 'Failed to load patient profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activePatientId) {
      fetchPatient();
    }
  }, [activePatientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const initials = patient && patient.name
    ? patient.name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '';

  const handleMenuPress = (menuId) => {
    if (!patient) return;
    if (menuId === 'history') {
      navigation.navigate('ConsultationHistory', { patientId: patient.id });
      return;
    }
    if (menuId === 'face') {
      navigation.navigate('FaceScanHistory', { patientId: patient.id });
      return;
    }
    if (menuId === 'tongue') {
      navigation.navigate('TongueScanHistory', { patientId: patient.id });
      return;
    }
    if (menuId === 'prescriptions') {
      navigation.navigate('PrescriptionHistory', { patientId: patient.id });
      return;
    }
  };

  const handleConsultation = () => {
    if (!appointment) return;
    navigation.navigate('ConsultationNotes', {
      appointment: { ...appointment, patientName: patient?.name },
    });
  };

  const apptStatus = appointment?.status;
  const isAppointmentActive = apptStatus === 'pending' || apptStatus === 'booked';
  const buttonLabel = apptStatus === 'pending' ? 'Start Consultation' : 'Continue Consultation';

  return (
    <View style={styles.root}>
      {/* Header */}
      <ScreenHeader title="Patient Profile" onBack={() => navigation.goBack()} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MCIcon name="alert-circle-outline" size={48} color={COLORS.danger} style={{ marginBottom: 12 }} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchPatient}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : patient ? (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              isAppointmentActive && { paddingBottom: 100 },
            ]}
            showsVerticalScrollIndicator={false}>
            {/* Top Profile Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <Text style={styles.profileName}>{patient.name}</Text>
              <Text style={styles.profileMeta}>{patient.gender} • {patient.ageStr || `${patient.age} Years`}</Text>

              <View style={styles.divider} />

              {/* Contact Information */}
              <View style={styles.contactContainer}>
                <View style={styles.contactRow}>
                  <MCIcon name="phone-outline" size={18} color={COLORS.textSecondary} style={styles.contactIcon} />
                  <Text style={styles.contactText}>{patient.phone || 'N/A'}</Text>
                </View>
                <View style={styles.contactRow}>
                  <MCIcon name="email-outline" size={18} color={COLORS.textSecondary} style={styles.contactIcon} />
                  <Text style={styles.contactText}>{patient.email || 'N/A'}</Text>
                </View>
              </View>
            </View>

            {/* Quick Summary Cards (Side by Side) */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryIconWrap}>
                  <MCIcon name="calendar-check" size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.summaryValue}>{patient.totalConsultations}</Text>
                <Text style={styles.summaryLabel}>Total Consultations</Text>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIconWrap}>
                  <MCIcon name="calendar-clock" size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.summaryValue}>{patient.lastVisit}</Text>
                <Text style={styles.summaryLabel}>Last Visit</Text>
              </View>
            </View>

            {/* Menu Cards */}
            <View style={styles.menuContainer}>
              {MENU_ITEMS.map((item, index) => (
                <React.Fragment key={item.id}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={() => handleMenuPress(item.id)}>
                    <View style={styles.menuItemLeft}>
                      <View style={styles.menuIconWrap}>
                        <MCIcon name={item.icon} size={20} color={COLORS.primary} />
                      </View>
                      <Text style={styles.menuItemTitle}>{item.title}</Text>
                    </View>
                    <MCIcon name="chevron-right" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                  {index < MENU_ITEMS.length - 1 && <View style={styles.menuDivider} />}
                </React.Fragment>
              ))}
            </View>
          </ScrollView>

          {/* Sticky Bottom Action Buttons if opened from Active Appointment details */}
          {isAppointmentActive && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.actionBtn}
                activeOpacity={0.85}
                onPress={handleConsultation}>
                <Text style={styles.actionBtnText}>{buttonLabel}</Text>
                <MCIcon name="arrow-right" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
};

export default PatientProfileScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.lg, paddingBottom: 40 },

  // Top Card
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    marginBottom: SPACING.md,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    width: '100%',
    marginBottom: SPACING.md,
  },
  contactContainer: {
    width: '100%',
    gap: SPACING.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    marginRight: SPACING.md,
    width: 20,
    textAlign: 'center',
  },
  contactText: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  // Summary Row (Side-by-Side Cards)
  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Menu Container
  menuContainer: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.border,
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

  // Footer for Consultation Actions
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
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
