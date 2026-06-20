import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import consultService from '../services/consultService';
import { COLORS } from '../constants/theme';

// ── Basic doctor card shown immediately using data from route.params ──────────
const DoctorBasicCard = ({ doctor }) => (
  <View style={styles.doctorCard}>
    <View style={styles.avatarCircle}>
      <Text style={styles.avatarIcon}>{doctor.avatar}</Text>
    </View>
    <Text style={styles.doctorName}>{doctor.name}</Text>
    <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>

    <View style={styles.ratingRow}>
      <Text style={styles.star}>⭐</Text>
      <Text style={styles.rating}>{doctor.rating}</Text>
      <Text style={styles.reviews}>({doctor.reviews} reviews)</Text>
    </View>

    <View style={styles.locationRow}>
      <Text style={styles.locationIcon}>📍</Text>
      <Text style={styles.location}>{doctor.location}</Text>
    </View>

    <View style={styles.tagsRow}>
      {doctor.tags.map((tag, index) => (
        <View key={index} style={styles.tag}>
          <Text style={styles.tagIcon}>
            {tag === 'Video' ? '📹' : '🏠'}
          </Text>
          <Text style={styles.tagText}>
            {tag === 'Video' ? 'Video Consult' : 'Home Visit'}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

const DoctorProfileScreen = ({ navigation, route }) => {
  const { doctor } = route.params; // basic info always available immediately

  const [detailData, setDetailData] = useState(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState(null);

  const fetchDoctorDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await consultService.getDoctorDetail(doctor.id);
      setDetailData(data);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [doctor.id]);

  useEffect(() => {
    fetchDoctorDetail();
  }, [fetchDoctorDetail]);

  // ── Full screen error ─────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <MCIcon name="alert-circle-outline" size={60} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Failed to load doctor details</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDoctorDetail} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Basic doctor info — shown immediately from route.params ── */}
        <DoctorBasicCard doctor={doctor} />

        {/* ── Detail sections — shown after API responds ── */}
        {isLoading ? (
          <View style={styles.detailLoader}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading details...</Text>
          </View>
        ) : detailData ? (
          <>
            {/* About */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <View style={styles.sectionCard}>
                <Text style={styles.aboutText}>{detailData.about}</Text>
              </View>
            </View>

            {/* Education */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Education</Text>
              <View style={styles.sectionCard}>
                <View style={styles.educationRow}>
                  <Text style={styles.educationIcon}>🎓</Text>
                  <View style={styles.educationInfo}>
                    <Text style={styles.educationDegree}>{detailData.education}</Text>
                    <Text style={styles.educationExp}>
                      {detailData.experience} years of experience
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {detailData.expertise?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Expertise</Text>
                <View style={styles.chipRow}>
                  {detailData.expertise.map((item, index) => (
                    <View key={index} style={styles.chip}>
                      <Text style={styles.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {detailData.languages?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Languages</Text>
                <View style={styles.chipRow}>
                  {detailData.languages.map((lang, index) => (
                    <View key={index} style={styles.chip}>
                      <Text style={styles.chipText}>{lang}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {detailData.awards?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Awards & Recognition</Text>
                <View style={styles.sectionCard}>
                  {detailData.awards.map((award, index) => (
                    <View
                      key={index}
                      style={[
                        styles.awardRow,
                        index < detailData.awards.length - 1 && styles.awardBorder,
                      ]}
                    >
                      <Text style={styles.awardIcon}>🏆</Text>
                      <View style={{flex: 1}}>
                        <Text style={styles.awardText}>{award.title}</Text>
                        <Text style={styles.awardIssuer}>{award.issuer} • {award.year}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* ── Bottom Bar ── */}
      <View style={styles.bottomBar}>
        <View style={styles.feeSection}>
          <Text style={styles.feeLabel}>Consultation Fee</Text>
          <Text style={styles.feeAmount}>₹{doctor.fee}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('BookAppointment', { doctor: detailData || doctor })}
        >
          <Text style={styles.bookBtnText}>Book Appointment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default DoctorProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },

  // Doctor Card
  doctorCard: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceMuted,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarIcon: { fontSize: 40 },
  doctorName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  star: { fontSize: 14 },
  rating: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  reviews: { fontSize: 13, color: COLORS.textMuted },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 4,
  },
  locationIcon: { fontSize: 13 },
  location: { fontSize: 13, color: COLORS.textSecondary },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  tagIcon: { fontSize: 13 },
  tagText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },

  // Detail loader (below the doctor card)
  detailLoader: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, color: COLORS.textMuted },

  // Full screen error
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  aboutText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },

  // Education
  educationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  educationIcon: { fontSize: 20 },
  educationInfo: { flex: 1 },
  educationDegree: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  educationExp: { fontSize: 12, color: COLORS.textMuted },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  // Awards
  awardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  awardBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.surfaceMuted },
  awardIcon: { fontSize: 18 },
  awardText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  awardIssuer: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceMuted,
    elevation: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  feeSection: {},
  feeLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 2 },
  feeAmount: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  bookBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
