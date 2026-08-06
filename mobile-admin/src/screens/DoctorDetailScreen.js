import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { DoctorDetailSkeleton } from '../components/SkeletonLoader';
import Avatar from '../components/Avatar';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert } from '../utils/alert';

const InfoItem = ({ icon, label, value, isLast }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <View style={[styles.infoItem, !isLast && styles.infoItemDivider]}>
    <View style={styles.iconContainer}>
        <MCIcon name={icon} size={22} color={colors.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
  );
};

const DoctorDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { doctorId } = route.params;
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availabilityByDay, setAvailabilityByDay] = useState([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchDoctor);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, doctorId]);

  const fetchDoctor = () => {
    setLoading(true);
    // The doctor record is the only critical call — render the profile even if
    // the (secondary) slot/availability lookups fail, instead of dropping the
    // whole screen to a "not found" / error state.
    apiClient.get(ENDPOINTS.DOCTOR_DETAIL(doctorId))
      .then(docRes => {
        setDoctor(docRes.data || docRes);
        return Promise.all([
          apiClient.get(ENDPOINTS.SLOT_TIMINGS).catch(() => null),
          apiClient.get(ENDPOINTS.DOCTOR_AVAILABILITY(doctorId)).catch(() => null),
        ]);
      })
      .then((results) => {
        if (!results) return;
        const [slotRes, availRes] = results;
        const allDays = slotRes?.data || slotRes || [];
        const availList = availRes?.data || availRes || [];
        const selectedIds = availList.map(a => a.slot_timing_id);
        const daysWithSlots = (Array.isArray(allDays) ? allDays : [])
          .map(day => ({
            ...day,
            slots: (day.slots || []).filter(s => selectedIds.includes(s.id)),
          }))
          .filter(day => day.slots.length > 0);
        setAvailabilityByDay(daysWithSlots);
      })
      .catch(() => showAlert('Error', 'Failed to load doctor details'))
      .finally(() => setLoading(false));
  };

  if (loading) return (
    <View style={styles.root}>
      <ScreenHeader title="Doctor Details" onBack={() => navigation.goBack()} />
      <DoctorDetailSkeleton />
    </View>
  );
  if (!doctor) return <View style={styles.root}><Text style={{ textAlign: 'center', marginTop: 100, color: colors.textMuted }}>Doctor not found</Text></View>;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Doctor Details"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => navigation.navigate('EditDoctor', { doctorId })} style={styles.headerButton}>
            <MCIcon name="pencil" size={24} color={colors.headerText} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <Avatar
            uri={doctor.avatar}
            name={doctor.name}
            size={100}
            backgroundColor={colors.primary}
            textColor={colors.white}
            style={styles.avatarLarge}
          />
          <Text style={styles.name}>{doctor.name}</Text>
          <View style={styles.specialtiesContainer}>
            {doctor.specialties?.map((spec, index) => (
              <View key={index} style={styles.specialtyChip}>
                <Text style={styles.specialtyText}>{spec}</Text>
              </View>
              ))}
          </View>
        </View>
        
        <View style={styles.card}>
          <InfoItem icon="information-outline" label="About" value={doctor.about || 'No description available.'} />
          <InfoItem icon="school-outline" label="Education" value={doctor.education || 'N/A'} />
          <InfoItem icon="clock-outline" label="Experience" value={doctor.experience ? `${doctor.experience} years` : 'N/A'} />
          <InfoItem icon="currency-inr" label="Consultation Fee" value={doctor.fee ? `₹${doctor.fee}` : 'N/A'} />
          <InfoItem icon="head-check-outline" label="Expertise" value={doctor.expertise?.join(', ') || 'N/A'} />
          <InfoItem icon="translate" label="Languages" value={doctor.languages?.join(', ') || 'N/A'} />
          
              {doctor.clinics && doctor.clinics.length > 0 && (
            <View style={styles.clinicSection}>
              <Text style={styles.clinicHeader}>Clinics</Text>
              {doctor.clinics.map((clinic, index) => (
                <View key={clinic.id || index} style={styles.clinicCard}>
                  <View style={styles.clinicHeaderRow}>
                    <MCIcon name="hospital-building" size={20} color={colors.primary} />
                    <Text style={styles.clinicName}>{clinic.name}</Text>
                    {clinic.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.clinicDetails}>
                    <TouchableOpacity
                      style={styles.clinicDetailRow}
                      activeOpacity={0.6}
                      onPress={() => {
                        const label = encodeURIComponent(clinic.name);
                        if (clinic.latitude && clinic.longitude) {
                          const { latitude, longitude } = clinic;
                          if (Platform.OS === 'ios') {
                            Linking.openURL(`maps://?q=${label}@${latitude},${longitude}`).catch(() =>
                              Linking.openURL(`https://maps.apple.com/?q=${label}&ll=${latitude},${longitude}`)
                            );
                          } else {
                            Linking.openURL(`geo:0,0?q=${latitude},${longitude}(${label})`).catch(() =>
                              Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`)
                            );
                          }
                        } else if (clinic.address) {
                          const query = encodeURIComponent(`${clinic.address}, ${clinic.city}`);
                          if (Platform.OS === 'ios') {
                            Linking.openURL(`maps://?q=${query}`).catch(() =>
                              Linking.openURL(`https://maps.apple.com/?q=${query}`)
                            );
                          } else {
                            Linking.openURL(`geo:0,0?q=${query}`).catch(() =>
                              Linking.openURL(`https://www.google.com/maps?q=${query}`)
                            );
                          }
                        } else {
                          showAlert('No Location', 'No location data available for this clinic.');
                        }
                      }}
                    >
                      <MCIcon name="map-marker" size={16} color={colors.textMuted} />
                      <Text style={[styles.clinicDetailText, styles.addressLink]}>{clinic.address}, {clinic.city}</Text>
                    </TouchableOpacity>
                    {clinic.phone && (
                      <TouchableOpacity
                        style={styles.clinicDetailRow}
                        activeOpacity={0.6}
                        onPress={() => Linking.openURL(`tel:${clinic.phone.replace(/[^+\d]/g, '')}`)}
                      >
                        <MCIcon name="phone" size={16} color={colors.textMuted} />
                        <Text style={[styles.clinicDetailText, styles.phoneLink]}>{clinic.phone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {doctor.awards && doctor.awards.length > 0 && (
            <View style={styles.awardSection}>
                <Text style={styles.awardHeader}>Awards</Text>
                {doctor.awards.map(award => (
                    <View key={award.id} style={styles.awardItem}>
                        <MCIcon name="trophy" size={20} color={colors.accent} />
                        <View style={styles.awardContent}>
                            <Text style={styles.awardTitle}>{award.title} ({award.year})</Text>
                            <Text style={styles.awardIssuer}>{award.issuer}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {availabilityByDay.length > 0 && (
            <View style={styles.availSection}>
              <Text style={styles.availHeader}>Availability</Text>
              {availabilityByDay.map(day => (
                <View key={day.id} style={styles.availDayRow}>
                  <Text style={styles.availDayLabel}>{day.day}</Text>
                  <View style={styles.availSlotRow}>
                    {day.slots.map(slot => (
                      <View key={slot.id} style={styles.availSlotChip}>
                        <Text style={styles.availSlotText}>
                          {slot.start_time ? slot.start_time.substring(0, 5) : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerButton: { padding: 4 },
  content: { padding: 20, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', marginBottom: 25 },
  avatarLarge: { marginBottom: 16, shadowColor: colors.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  name: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  specialtiesContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  specialtyChip: { backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, margin: 4 },
  specialtyText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  card: { backgroundColor: colors.card, padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  infoItem: { flexDirection: 'row', paddingVertical: 16 },
  infoItemDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  infoContent: { flex: 1, justifyContent: 'center' },
  infoLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: colors.textPrimary, fontWeight: '600', lineHeight: 20 },

  clinicSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  clinicHeader: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  clinicCard: { backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  clinicHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  clinicName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  primaryBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  primaryBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  clinicDetails: { marginLeft: 4, gap: 6 },
  clinicDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicDetailText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  addressLink: { textDecorationLine: 'underline', color: colors.primary },
  phoneLink: { textDecorationLine: 'underline', color: colors.primary },
  awardSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  awardHeader: { fontSize: 12, color: colors.textSecondary, marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  awardItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  awardContent: { marginLeft: 12 },
  awardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  awardIssuer: { fontSize: 12, color: colors.textSecondary },
  availSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  availHeader: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  availDayRow: { marginBottom: 10 },
  availDayLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  availSlotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  availSlotChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.primaryLight },
  availSlotText: { fontSize: 12, color: colors.primary, fontWeight: '500' },
});

export default DoctorDetailScreen;
