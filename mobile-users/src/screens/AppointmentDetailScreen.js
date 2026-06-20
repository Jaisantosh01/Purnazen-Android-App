import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, APPOINTMENT_DETAIL_STATUS_COLORS } from '../constants/theme';
import { APPOINTMENT_HISTORY_STATUS_LABELS, APPOINTMENT_PAYMENT_LABELS } from '../constants/strings';


const STATUS_COLORS = APPOINTMENT_DETAIL_STATUS_COLORS;
const STATUS_LABELS = APPOINTMENT_HISTORY_STATUS_LABELS;
const PAYMENT_LABELS = APPOINTMENT_PAYMENT_LABELS;

const getInitials = (name) => {
  if (!name) return 'D';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
};

const AppointmentDetailScreen = ({ navigation, route }) => {
  const { appointment } = route.params;

  const DetailRow = ({ label, value, highlight }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.doctorCard}>
          <View style={styles.doctorCardTop}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {getInitials(appointment.doctorName)}
              </Text>
            </View>
            <View style={styles.doctorInfo}>
              <View style={styles.doctorNameRow}>
                <Text style={styles.doctorName} numberOfLines={1}>{appointment.doctorName}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[appointment.status] || '#9CA3AF' }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[appointment.status] || appointment.status}</Text>
                </View>
              </View>
              <Text style={styles.specialty}>{appointment.specialty}</Text>
              {(appointment.rating || appointment.experience || appointment.location) && (
                <View style={styles.metaRow}>
                  {appointment.rating ? (
                    <View style={styles.metaItem}>
                      <MCIcon name="star" size={13} color="#F59E0B" />
                      <Text style={styles.metaText}>{appointment.rating}</Text>
                    </View>
                  ) : null}
                  {appointment.experience ? (
                    <View style={styles.metaItem}>
                      <MCIcon name="briefcase-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.metaText}>{appointment.experience} yrs</Text>
                    </View>
                  ) : null}
                  {appointment.location ? (
                    <View style={styles.metaItem}>
                      <MCIcon name="map-marker-outline" size={13} color={COLORS.textMuted} />
                      <Text style={styles.metaText} numberOfLines={1}>{appointment.location}</Text>
                    </View>
                  ) : null}
                </View>
              )}
              {appointment.expertise?.length > 0 && (
                <View style={styles.chipRow}>
                  {appointment.expertise.map((exp, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{exp}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appointment Info</Text>
          <View style={styles.infoCard}>
            <DetailRow label="Reference" value={appointment.reference} />
            <DetailRow label="Date" value={appointment.date} />
            <DetailRow label="Time" value={`${appointment.time} - ${appointment.endTime}`} />
            <DetailRow label="Consultation Type" value={appointment.consultationType} />
            <DetailRow label="Fee" value={`₹${appointment.fee}`} highlight />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment & Status</Text>
          <View style={styles.infoCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[appointment.status] || '#9CA3AF' }]}>
                <Text style={styles.statusText}>{STATUS_LABELS[appointment.status] || appointment.status}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment</Text>
              <View style={[styles.statusBadge, {
                backgroundColor: appointment.paymentStatus === 'paid' ? '#10B981' : '#F59E0B',
              }]}>
                <Text style={styles.statusText}>{PAYMENT_LABELS[appointment.paymentStatus] || appointment.paymentStatus}</Text>
              </View>
            </View>
          </View>
        </View>

        {appointment.userDescription ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Description</Text>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{appointment.userDescription}</Text>
            </View>
          </View>
        ) : null}

        {appointment.doctorDescription ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Doctor's Notes</Text>
            <View style={[styles.descriptionCard, { borderLeftColor: COLORS.accent }]}>
              <Text style={styles.descriptionText}>{appointment.doctorDescription}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default AppointmentDetailScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceMuted,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  content: { padding: 16, gap: 16, paddingBottom: 40 },

  doctorCard: {
    backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden',
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  doctorCardTop: {
    flexDirection: 'row', padding: 16, gap: 14,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.primary,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  doctorInfo: { flex: 1, gap: 4 },
  doctorNameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  doctorName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, flexShrink: 1 },
  specialty: { fontSize: 13, color: COLORS.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: COLORS.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: COLORS.primaryFaint, borderWidth: 1, borderColor: COLORS.primaryLight,
  },
  chipText: { fontSize: 11, fontWeight: '500', color: COLORS.primary },

  infoCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, gap: 12,
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  detailLabel: { fontSize: 13, color: COLORS.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  detailValueHighlight: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },

  descriptionCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  descriptionText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
});
