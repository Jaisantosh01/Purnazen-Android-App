import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { COLORS } from '../constants/theme';
import { DoctorDetailSkeleton } from '../components/SkeletonLoader';

const InfoItem = ({ icon, label, value, isLast }) => (
  <View style={[styles.infoItem, !isLast && styles.infoItemDivider]}>
    <View style={styles.iconContainer}>
        <MCIcon name={icon} size={22} color={COLORS.primary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const DoctorDetailScreen = ({ route, navigation }) => {
  const { doctorId } = route.params;
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availabilityByDay, setAvailabilityByDay] = useState([]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchDoctor);
    return unsubscribe;
  }, [navigation, doctorId]);

  const fetchDoctor = () => {
    setLoading(true);
    Promise.all([
      apiClient.get(ENDPOINTS.DOCTOR_DETAIL(doctorId)),
      apiClient.get(ENDPOINTS.SLOT_TIMINGS),
      apiClient.get(ENDPOINTS.DOCTOR_AVAILABILITY(doctorId)),
    ])
      .then(([docRes, slotRes, availRes]) => {
        setDoctor(docRes.data || docRes);
        const allDays = slotRes.data || slotRes || [];
        const availList = availRes.data || availRes || [];
        const selectedIds = availList.map(a => a.slot_timing_id);
        const daysWithSlots = allDays
          .map(day => ({
            ...day,
            slots: (day.slots || []).filter(s => selectedIds.includes(s.id)),
          }))
          .filter(day => day.slots.length > 0);
        setAvailabilityByDay(daysWithSlots);
      })
      .catch(() => Alert.alert('Error', 'Failed to load doctor details'))
      .finally(() => setLoading(false));
  };

  if (loading) return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctor Details</Text>
        <View style={{ width: 44 }} />
      </View>
      <DoctorDetailSkeleton />
    </View>
  );
  if (!doctor) return <View style={styles.root}><Text style={{ textAlign: 'center', marginTop: 100, color: COLORS.textMuted }}>Doctor not found</Text></View>;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <MCIcon name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctor Details</Text>
        <TouchableOpacity onPress={() => navigation.navigate('EditDoctor', { doctorId })} style={styles.headerButton}>
          <MCIcon name="pencil" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
             <MCIcon name="account" size={60} color={COLORS.white} />
          </View>
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
          <InfoItem icon="currency-usd" label="Consultation Fee" value={doctor.fee ? `$${doctor.fee}` : 'N/A'} />
          <InfoItem icon="head-check-outline" label="Expertise" value={doctor.expertise?.join(', ') || 'N/A'} />
          <InfoItem icon="translate" label="Languages" value={doctor.languages?.join(', ') || 'N/A'} />
          
          {doctor.clinics && doctor.clinics.length > 0 && (
            <View style={styles.clinicSection}>
              <Text style={styles.clinicHeader}>Clinics</Text>
              {doctor.clinics.map((clinic, index) => (
                <View key={clinic.id || index} style={styles.clinicCard}>
                  <View style={styles.clinicHeaderRow}>
                    <MCIcon name="hospital-building" size={20} color={COLORS.primary} />
                    <Text style={styles.clinicName}>{clinic.name}</Text>
                    {clinic.is_primary && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Primary</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.clinicDetails}>
                    <View style={styles.clinicDetailRow}>
                      <MCIcon name="map-marker" size={16} color={COLORS.textMuted} />
                      <Text style={styles.clinicDetailText}>{clinic.address}, {clinic.city}</Text>
                    </View>
                    {clinic.phone && (
                      <View style={styles.clinicDetailRow}>
                        <MCIcon name="phone" size={16} color={COLORS.textMuted} />
                        <Text style={styles.clinicDetailText}>{clinic.phone}</Text>
                      </View>
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
                        <MCIcon name="trophy" size={20} color={COLORS.accent} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.white, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  headerButton: { padding: 4 },
  content: { padding: 20, paddingBottom: 40 },
  profileHeader: { alignItems: 'center', marginBottom: 25 },
  avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: COLORS.primary, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  name: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  specialtiesContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  specialtyChip: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, margin: 4 },
  specialtyText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  card: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  infoItem: { flexDirection: 'row', paddingVertical: 16 },
  infoItemDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f7ff', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  infoContent: { flex: 1, justifyContent: 'center' },
  infoLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '600', lineHeight: 20 },

  clinicSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16 },
  clinicHeader: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  clinicCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  clinicHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  clinicName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  primaryBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  primaryBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },
  clinicDetails: { marginLeft: 4, gap: 6 },
  clinicDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicDetailText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  awardSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16 },
  awardHeader: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  awardItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  awardContent: { marginLeft: 12 },
  awardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  awardIssuer: { fontSize: 12, color: COLORS.textSecondary },
  availSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16 },
  availHeader: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  availDayRow: { marginBottom: 10 },
  availDayLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 6 },
  availSlotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  availSlotChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: COLORS.primaryLight },
  availSlotText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
});

export default DoctorDetailScreen;
