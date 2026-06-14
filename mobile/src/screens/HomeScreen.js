import React, { useEffect, useState } from 'react';
import { STRINGS } from '../constants/strings';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import QuickCard from '../components/QuickCards';
import { WellnessRowSkeleton, QuickCardSkeleton } from '../components/SkeletonLoader';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import wellnessService from '../services/wellnessService';
import { COLORS } from '../constants/theme';

// The catalog API carries emoji icons (player header); the Home rows render
// MaterialCommunityIcons, so map by session key.
const WELLNESS_ROW_ICONS = {
  YogaSession: 'yoga',
  MeditationSession: 'meditation',
  BreathingSession: 'lungs',
  MorningRoutineSession: 'weather-sunny',
  EveningWindDown: 'weather-night',
  FullBodyStretch: 'human-handsup',
};

const HOME_WELLNESS_ROWS = 3; // teaser only — "See All" opens the Wellness tab

const HomeScreen = ({ navigation }) => {
  const [quickRelief, setQuickRelief] = useState([]);
  const [wellness, setWellness] = useState([]);
  const [reliefLoading, setReliefLoading] = useState(true);
  const [wellnessLoading, setWellnessLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.HOME_QUICK_RELIEF)
      .then(res => setQuickRelief(res?.data || []))
      .catch(() => setQuickRelief([]))
      .finally(() => setReliefLoading(false));

    wellnessService
      .getAllSessions()
      .then(data => {
        const sessions = (data?.sessions || []).slice(0, HOME_WELLNESS_ROWS);
        setWellness(
          sessions.map(s => ({
            key: s.key,
            title: s.title,
            duration: s.duration,
            icon: WELLNESS_ROW_ICONS[s.key] || 'heart-pulse',
          })),
        );
      })
      .catch(() => setWellness([]))
      .finally(() => setWellnessLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}>{STRINGS.HOME_TITLE}</Text>
          <Text style={styles.subtitle}>{STRINGS.HOME_SUBTITLE}</Text>

          <TouchableOpacity style={styles.banner} activeOpacity={0.9}>
            <View style={styles.bannerIconCircle}>
              <MCIcon name="sparkles" size={18} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{STRINGS.BANNER_TITLE}</Text>
              <Text style={styles.bannerSub}>{STRINGS.BANNER_SUB}</Text>
            </View>
            <MCIcon name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* ── Quick Relief ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Relief</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ReliefTab')}>
              <Text style={styles.seeAll}>{STRINGS.SEE_ALL}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {reliefLoading ? (
              [1, 2, 3, 4].map(i => <QuickCardSkeleton key={i} />)
            ) : quickRelief.length > 0 ? (
              quickRelief.map(item => (
                <QuickCard
                  key={item.id}
                  title={item.title}
                  iconName={item.icon_name}
                  bg={item.background_color}
                  color={item.text_color}
                  sub={item.subtitle}
                  onPress={() =>
                    navigation.navigate('ReliefSession', {
                      reliefId: item.id,
                      reliefSlug: item.slug,
                      reliefTitle: item.title,
                    })
                  }
                />
              ))
            ) : (
              <TouchableOpacity
                style={styles.emptyBanner}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('ReliefTab')}
              >
                <MCIcon name="hand-heart-outline" size={24} color={COLORS.primary} style={{ marginRight: 10 }} />
                <Text style={styles.emptyBannerText}>Browse relief sessions →</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Wellness ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{STRINGS.WELLNESS_SECTION}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('WellnessTab')}>
              <Text style={styles.seeAll}>{STRINGS.SEE_ALL}</Text>
            </TouchableOpacity>
          </View>

          {wellnessLoading ? (
            [1, 2, 3].map(i => <WellnessRowSkeleton key={i} />)
          ) : wellness.length > 0 ? (
            wellness.map((item, index) => (
              <TouchableOpacity
                key={item.key ?? index}
                style={styles.wellnessRow}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('SessionScreen', { sessionKey: item.key })}
              >
                <View style={styles.wellnessIconCircle}>
                  <MCIcon name={item.icon} size={22} color={COLORS.primary} />
                </View>
                <View style={styles.wellnessInfo}>
                  <Text style={styles.wellnessTitle}>{item.title}</Text>
                  <Text style={styles.wellnessDuration}>{item.duration}</Text>
                </View>
                <View style={styles.videoBtn}>
                  <MCIcon name="play-circle-outline" size={20} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            ))
          ) : null}

          {/* Face Glow Card */}
          <TouchableOpacity
            style={styles.faceGlowCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('FaceGlow')}
          >
            <View style={styles.faceGlowLeft}>
              <View style={styles.faceGlowIconCircle}>
                <MCIcon name="star-four-points-outline" size={20} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.faceGlowTitle}>{STRINGS.FACE_GLOW_TITLE}</Text>
                <Text style={styles.faceGlowSub}>{STRINGS.FACE_GLOW_SUB}</Text>
              </View>
            </View>
            <MCIcon name="chevron-right" size={20} color="#d4789a" />
          </TouchableOpacity>
        </View>

        {/* ── Book a Consultation ── */}
        <TouchableOpacity
          style={styles.consultBanner}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('ConsultTab')}
        >
          <View style={styles.consultLeft}>
            <View style={styles.consultIconCircle}>
              <MCIcon name="calendar-month-outline" size={20} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.consultTitle}>{STRINGS.CONSULT_TITLE}</Text>
              <Text style={styles.consultSub}>{STRINGS.CONSULT_SUB}</Text>
            </View>
          </View>
          <View style={styles.consultArrowCircle}>
            <MCIcon name="arrow-right" size={18} color={COLORS.white} />
          </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    fontSize: 26,
    color: COLORS.white,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 2,
    marginBottom: 18,
  },
  banner: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 1,
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Quick Relief Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  emptyBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    padding: 16,
  },
  emptyBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Wellness Rows
  wellnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  wellnessIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  wellnessInfo: {
    flex: 1,
  },
  wellnessTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  wellnessDuration: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  videoBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    padding: 8,
  },

  // Face Glow Card
  faceGlowCard: {
    backgroundColor: '#fdf0f5',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  faceGlowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  faceGlowIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e8a0c0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  faceGlowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  faceGlowSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  // Consult Banner
  consultBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  consultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  consultIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  consultTitle: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  consultSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 1,
  },
  consultArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
