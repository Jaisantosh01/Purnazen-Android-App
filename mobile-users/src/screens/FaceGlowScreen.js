import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { RoutineCardSkeleton } from '../components/SkeletonLoader';
import { COLORS } from '../constants/theme';

// Static — informational copy, not a DB resource
const BENEFITS = [
  { id: 1, icon: 'blur',                  title: 'Reduces Puffiness' },
  { id: 2, icon: 'flower-outline',        title: 'Natural Glow' },
  { id: 3, icon: 'dna',                   title: 'Boosts Collagen' },
  { id: 4, icon: 'heart-pulse',           title: 'Better Circulation' },
  { id: 5, icon: 'emoticon-happy-outline', title: 'Stress Relief' },
  { id: 6, icon: 'leaf',                  title: 'Detoxifies Skin' },
];

const FaceGlowScreen = ({ navigation }) => {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.FACE_GLOW_ROUTINES)
      .then(res => setRoutines(res?.data?.routines || []))
      .catch(() => setRoutines([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
            >
              <MCIcon name="arrow-left" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.navigate('ScanDashboard')}
              >
                <MCIcon name="chart-line" size={22} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => navigation.navigate('ScanHistory')}
              >
                <MCIcon name="history" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Face Glow</Text>
            <Text style={styles.headerSubtitle}>Radiant skin · acupressure routines</Text>
          </View>

          {/* ── Face Scan Card ── */}
          <View style={styles.scanCard}>
            <View style={styles.scanLeft}>
              <View style={styles.cameraCircle}>
                <MCIcon name="face-recognition" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanTitle}>AI Face Analysis</Text>
                <Text style={styles.scanSubtitle}>Hydration · oil · fine lines · glow score</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.scanBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('FaceScan', { scanType: 'face' })}
            >
              <Text style={styles.scanBtnText}>Start Face Scan</Text>
            </TouchableOpacity>
          </View>

          {/* ── Tongue Scan Card ── */}
          <View style={[styles.scanCard, styles.tongueCard]}>
            <View style={styles.scanLeft}>
              <View style={[styles.cameraCircle, styles.tongueCameraCircle]}>
                <MCIcon name="emoticon-tongue-outline" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanTitle}>TCM Tongue Analysis</Text>
                <Text style={styles.scanSubtitle}>Qi · organ health · wellness score</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.scanBtn, styles.tongueScanBtn]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('TongueScan')}
            >
              <Text style={[styles.scanBtnText, styles.tongueScanBtnText]}>Start Tongue Scan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Onboarding: basic now → personalized after a scan ── */}
        <View style={styles.section}>
          <View style={styles.personalizeBanner}>
            <MCIcon name="lightbulb-on-outline" size={20} color="#C850C0" />
            <View style={{ flex: 1 }}>
              <Text style={styles.personalizeTitle}>These are general routines</Text>
              <Text style={styles.personalizeText}>
                Scan your face and our AI tailors the routines and wellness tips to your
                skin — hydration, oil, fine lines and more.
              </Text>
            </View>
          </View>
        </View>

        {/* ── Routines ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Routines</Text>

          {loading ? (
            [1, 2, 3].map(i => <RoutineCardSkeleton key={i} />)
          ) : routines.length > 0 ? (
            routines.map(routine => (
              <View key={routine.key} style={styles.routineCard}>
                <View style={styles.routineTop}>
                  <Text style={styles.routineIcon}>{routine.icon}</Text>
                  <View style={styles.routineInfo}>
                    <View style={styles.routineTitleRow}>
                      <Text style={styles.routineTitle}>{routine.title}</Text>
                      <View style={styles.durationChip}>
                        <MCIcon name="clock-outline" size={12} color={COLORS.textMuted} />
                        <Text style={styles.routineDuration}> {routine.duration}</Text>
                      </View>
                    </View>
                    {routine.benefits.map((b, i) => (
                      <Text key={i} style={styles.benefitItem}>• {b}</Text>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.playBtn}
                    onPress={() => Alert.alert(routine.title, 'Starting routine!')}
                  >
                    <MCIcon name="play" size={14} color="#C850C0" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MCIcon name="spa-outline" size={40} color={COLORS.borderStrong} />
              <Text style={styles.emptyTitle}>No routines available</Text>
              <Text style={styles.emptySub}>Check back soon for personalised face glow routines</Text>
            </View>
          )}
        </View>

        {/* ── Benefits ── */}
        <View style={styles.section}>
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Benefits of Face Acupressure</Text>
            <View style={styles.benefitsGrid}>
              {BENEFITS.map(benefit => (
                <View key={benefit.id} style={styles.benefitBox}>
                  <MCIcon name={benefit.icon} size={22} color={COLORS.primary} style={styles.benefitIcon} />
                  <Text style={styles.benefitText}>{benefit.title}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

export default FaceGlowScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: '#C850C0',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Scan Card
  scanCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 18,
    padding: 16,
  },
  scanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  cameraCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  scanSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  scanBtn: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C850C0',
  },
  tongueCard: {
    marginTop: 10,
    backgroundColor: 'rgba(250,121,33,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tongueCameraCircle: {
    backgroundColor: 'rgba(250,121,33,0.6)',
  },
  tongueScanBtn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tongueScanBtnText: {
    color: COLORS.white,
  },

  // Onboarding banner
  personalizeBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fdf4ff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  personalizeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  personalizeText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 14,
  },

  // Routine Cards
  routineCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  routineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routineIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  routineInfo: {
    flex: 1,
  },
  routineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  routineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  durationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  routineDuration: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  benefitItem: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  // Benefits Card
  benefitsCard: {
    backgroundColor: '#fdf4ff',
    borderRadius: 16,
    padding: 18,
  },
  benefitsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  benefitBox: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
});
