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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchDoctor);
    return unsubscribe;
  }, [navigation, doctorId]);

  const fetchDoctor = () => {
    setLoading(true);
    apiClient
      .get(ENDPOINTS.DOCTOR_DETAIL(doctorId))
      .then(res => {
        setDoctor(res.data || res);
      })
      .catch(() => Alert.alert('Error', 'Failed to load doctor details'))
      .finally(() => setLoading(false));
  };

  if (loading) return <View style={styles.root}><Text style={styles.loading}>Loading...</Text></View>;
  if (!doctor) return <View style={styles.root}><Text style={styles.loading}>Doctor not found</Text></View>;

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
          <InfoItem icon="translate" label="Languages" value={doctor.languages?.join(', ') || 'N/A'} isLast />
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
  loading: { textAlign: 'center', marginTop: 100 }
});

export default DoctorDetailScreen;
