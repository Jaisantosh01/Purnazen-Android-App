import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  Share,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { showAlert } from '../utils/alert';
import { APPOINTMENT_DETAIL_STATUS_COLORS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { APPOINTMENT_HISTORY_STATUS_LABELS, APPOINTMENT_PAYMENT_LABELS } from '../constants/strings';
import { useHeaderTopPadding } from '../components/ScreenHeader';
import LocationCard from '../components/LocationCard';


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
  const headerTop = useHeaderTopPadding();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { appointment } = route.params;

  const copyLink = useCallback(() => {
    if (appointment.meetingLink) {
      Share.share({ message: appointment.meetingLink, title: 'Meeting Link' });
    }
  }, [appointment.meetingLink]);

  const DetailRow = ({ label, value, highlight }) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={[styles.header, { paddingTop: headerTop }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color={colors.textPrimary} />
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
                      <MCIcon name="briefcase-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.metaText}>{appointment.experience} yrs</Text>
                    </View>
                  ) : null}
                  {appointment.location ? (
                    <View style={styles.metaItem}>
                      <MCIcon name="map-marker-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.metaText} numberOfLines={1}>{appointment.location.name}</Text>
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


            {(appointment.consultationType || '').toLowerCase().includes('video') && appointment.meetingLink ? (
              <View style={styles.meetingSection}>
                <View style={styles.meetingHeader}>
                  <MCIcon name="video-outline" size={16} color={colors.primary} style={styles.meetingIcon} />
                  <Text style={styles.meetingLabel}>Meeting Link</Text>
                </View>
                <Text style={styles.meetingLinkText} numberOfLines={1}>{appointment.meetingLink}</Text>
                <View style={styles.meetingActions}>
                  <TouchableOpacity
                    style={styles.meetingBtn}
                    onPress={() => Linking.openURL(appointment.meetingLink)}
                    activeOpacity={0.8}
                  >
                    <MCIcon name="video" size={15} color={colors.white} />
                    <Text style={styles.meetingBtnText}>Join</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.meetingBtnOutline}
                    onPress={copyLink}
                    activeOpacity={0.8}
                  >
                    <MCIcon name="content-copy" size={15} color={colors.primary} />
                    <Text style={styles.meetingBtnOutlineText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <DetailRow label="Fee" value={`₹${appointment.fee}`} highlight />
          </View>
        </View>

        {appointment.location ? (
          <LocationCard location={appointment.location} />
        ) : null}

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
            <View style={[styles.descriptionCard, { borderLeftColor: colors.accent }]}>
              <Text style={styles.descriptionText}>{appointment.doctorDescription}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default AppointmentDetailScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },

  content: { padding: 16, gap: 16, paddingBottom: 40 },

  doctorCard: {
    backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden',
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  doctorCardTop: {
    flexDirection: 'row', padding: 16, gap: 14,
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primary,
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  doctorInfo: { flex: 1, gap: 4 },
  doctorNameRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  doctorName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
  specialty: { fontSize: 13, color: colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, color: colors.textMuted },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700', color: colors.white },

  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: colors.primaryFaint, borderWidth: 1, borderColor: colors.primaryLight,
  },
  chipText: { fontSize: 11, fontWeight: '500', color: colors.primary },

  infoCard: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 12,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  detailValueHighlight: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  addressSection: {
    flexDirection: 'row', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.surfaceMuted,
  },
  addressIcon: { marginTop: 2 },
  addressContent: { flex: 1 },
  addressTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 2 },
  addressText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  meetingSection: {
    flexDirection: 'column', gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.surfaceMuted,
  },
  meetingHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meetingIcon: { fontSize: 16 },
  meetingLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  meetingLinkText: { fontSize: 11, color: colors.textMuted, fontFamily: 'monospace' },
  meetingActions: { flexDirection: 'row', gap: 10 },
  meetingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  meetingBtnText: { fontSize: 12, fontWeight: '700', color: colors.white },
  meetingBtnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  meetingBtnOutlineText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  descriptionCard: {
    backgroundColor: colors.card, borderRadius: 14, padding: 16,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  descriptionText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
});
