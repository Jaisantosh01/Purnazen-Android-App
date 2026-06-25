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
import useTheme from '../hooks/useTheme';
import { useMemo } from 'react';
import { doctorInitial } from '../utils/doctorAvatar';
import ScreenHeader from '../components/ScreenHeader';

// ── Basic doctor card shown immediately using data from route.params ──────────
const DoctorBasicCard = ({ doctor, styles, colors }) => (
  <View style={styles.doctorCard}>
    <View style={styles.avatarCircle}>
      <Text style={styles.avatarIcon}>{doctorInitial(doctor.name)}</Text>
    </View>
    <Text style={styles.doctorName}>{doctor.name}</Text>
    <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>

    <View style={styles.ratingRow}>
      <MCIcon name="star" size={15} color={colors.warning} style={styles.star} />
      <Text style={styles.rating}>{doctor.rating}</Text>
      <Text style={styles.reviews}>({doctor.reviews} reviews)</Text>
    </View>

    <View style={styles.locationRow}>
      <MCIcon name="map-marker" size={14} color={colors.textMuted} style={styles.locationIcon} />
      <Text style={styles.location}>{doctor.location}</Text>
    </View>

    <View style={styles.tagsRow}>
      {doctor.tags.map((tag, index) => (
        <View key={index} style={styles.tag}>
          <MCIcon
            name={tag === 'Video' ? 'video-outline' : 'home-outline'}
            size={14}
            color={colors.primary}
            style={styles.tagIcon}
          />
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        <ScreenHeader title="Doctor Profile" variant="light" />
        <View style={styles.centered}>
          <MCIcon name="alert-circle-outline" size={60} color={colors.danger} />
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
      <ScreenHeader title="Doctor Profile" variant="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Basic doctor info — shown immediately from route.params ── */}
        <DoctorBasicCard doctor={doctor} styles={styles} colors={colors} />

        {/* ── Detail sections — shown after API responds ── */}
        {isLoading ? (
          <View style={styles.detailLoader}>
            <ActivityIndicator size="large" color={colors.primary} />
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
                  <MCIcon name="school" size={20} color={colors.primary} style={styles.educationIcon} />
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
                      <MCIcon name="trophy-outline" size={18} color={colors.warning} style={styles.awardIcon} />
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

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.card,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 22, color: colors.textPrimary },

  // Doctor Card
  doctorCard: {
    backgroundColor: colors.card,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarIcon: { fontSize: 34, fontWeight: '800', color: colors.primary },
  doctorName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  star: { fontSize: 14 },
  rating: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  reviews: { fontSize: 13, color: colors.textMuted },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 4,
  },
  locationIcon: { fontSize: 13 },
  location: { fontSize: 13, color: colors.textSecondary },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  tagIcon: { fontSize: 13 },
  tagText: { fontSize: 12, color: colors.primary, fontWeight: '500' },

  // Detail loader (below the doctor card)
  detailLoader: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, color: colors.textMuted },

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
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryText: { fontSize: 15, fontWeight: '700', color: colors.white },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  aboutText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Education
  educationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  educationIcon: { fontSize: 20 },
  educationInfo: { flex: 1 },
  educationDegree: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  educationExp: { fontSize: 12, color: colors.textMuted },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

  // Awards
  awardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  awardBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  awardIcon: { fontSize: 18 },
  awardText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  awardIssuer: { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  feeSection: {},
  feeLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  feeAmount: { fontSize: 20, fontWeight: '700', color: colors.primary },
  bookBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
