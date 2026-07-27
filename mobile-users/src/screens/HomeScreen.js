import React, { useEffect, useMemo, useState } from 'react';
import { STRINGS } from '../constants/strings';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import QuickCard from '../components/QuickCards';
import { WellnessRowSkeleton, QuickCardSkeleton } from '../components/SkeletonLoader';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import wellnessService from '../services/wellnessService';
import useTheme from '../hooks/useTheme';
import notificationsService from '../services/notificationsService';
import TabHeader from '../components/TabHeader';

const HOME_WELLNESS_ROWS = 3; 
const HOME_QUICK_RELIEF_LIMIT = 3; 

const HomeScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [quickRelief, setQuickRelief] = useState([]);
  const [wellness, setWellness] = useState([]);
  const [reliefLoading, setReliefLoading] = useState(true);
  const [wellnessLoading, setWellnessLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refresh the bell badge whenever Home regains focus
  useEffect(() => {
    const refreshBadge = () =>
      notificationsService.unreadCount().then(setUnreadCount).catch(() => {});
    refreshBadge();
    const unsubscribe = navigation.addListener('focus', refreshBadge);
    return unsubscribe;
  }, [navigation]);

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
            id: s.id,
            title: s.title,
            duration: s.duration,
            icon: 'heart-pulse',
            videoGroupId: s.videoGroupId,
          })),
        );
      })
      .catch(() => setWellness([]))
      .finally(() => setWellnessLoading(false));
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Header ── */}
        <TabHeader
          title={STRINGS.HOME_TITLE}
          subtitle={STRINGS.HOME_SUBTITLE}
          right={
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => navigation.navigate('NotificationCenter')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MCIcon name="bell-outline" size={24} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          }
        />

        {/* ── Quick Relief ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Relief</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Relief')}>
              <Text style={styles.seeAll}>{STRINGS.SEE_ALL}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {reliefLoading ? (
              [1, 2, 3, 4].map(i => <QuickCardSkeleton key={i} />)
            ) : quickRelief.length > 0 ? (
              quickRelief.slice(0, HOME_QUICK_RELIEF_LIMIT).map(item => (
                <QuickCard
                  key={item.id}
                  title={item.title}
                  iconName={item.icon_name}
                  bg={item.background_color}
                  color={item.text_color}
                  sub={item.subtitle}
                  onPress={() => {
                    if (item.chatQuestionId) {
                      navigation.navigate('ChatAssistant', {
                        startQuestionId: item.chatQuestionId,
                        reliefTitle: item.title,
                      });
                    } else {
                      navigation.navigate('ReliefSession', {
                        reliefId: item.id,
                        reliefSlug: item.slug,
                        reliefTitle: item.title,
                      });
                    }
                  }}
                />
              ))
            ) : (
              <TouchableOpacity
                style={styles.emptyBanner}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Relief')}
              >
                <MCIcon name="hand-heart-outline" size={24} color={colors.primary} style={{ marginRight: 10 }} />
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
                key={item.id ?? index}
                style={styles.wellnessRow}
                activeOpacity={0.85}
                onPress={() => {
                  if (item.videoGroupId) {
                    navigation.navigate('VideoPlayer', {
                      groupId: item.videoGroupId,
                      groupTitle: item.title,
                    });
                  }
                }}
              >
                <View style={styles.wellnessIconCircle}>
                  <MCIcon name={item.icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.wellnessInfo}>
                  <Text style={styles.wellnessTitle}>{item.title}</Text>
                  <Text style={styles.wellnessDuration}>{item.duration}</Text>
                </View>
                <View style={styles.videoBtn}>
                  <MCIcon name="play-circle-outline" size={20} color={colors.primary} />
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
                <MCIcon name="star-four-points-outline" size={20} color={colors.white} />
              </View>
              <View>
                <Text style={styles.faceGlowTitle}>{STRINGS.FACE_GLOW_TITLE}</Text>
                <Text style={styles.faceGlowSub}>{STRINGS.FACE_GLOW_SUB}</Text>
              </View>
            </View>
            <MCIcon name="chevron-right" size={20} color="#d4789a" />
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Book a Consultation — sticky above the tab bar ── */}
      <TouchableOpacity
        style={styles.consultBanner}
        activeOpacity={0.88}
        onPress={() => navigation.navigate('ConsultTab')}
      >
        <View style={styles.consultLeft}>
          <View style={styles.consultIconCircle}>
            <MCIcon name="calendar-month-outline" size={20} color={colors.white} />
          </View>
          <View>
            <Text style={styles.consultTitle}>{STRINGS.CONSULT_TITLE}</Text>
            <Text style={styles.consultSub}>{STRINGS.CONSULT_SUB}</Text>
          </View>
        </View>
        <View style={styles.consultArrowCircle}>
          <MCIcon name="arrow-right" size={18} color={colors.white} />
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default HomeScreen;

const makeStyles = colors => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },

  // Header — the card itself now comes from <TabHeader/>; only the bell, which
  // is passed in as the header's `right` slot, is styled here.
  bellBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

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
    color: colors.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    color: colors.primary,
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
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 16,
  },
  emptyBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Wellness Rows
  wellnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  wellnessIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
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
    color: colors.textPrimary,
  },
  wellnessDuration: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  videoBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 8,
  },

  // Face Glow Card — translucent pink tint adapts to light/dark surfaces
  faceGlowCard: {
    backgroundColor: 'rgba(232,160,192,0.16)',
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
    color: colors.textPrimary,
  },
  faceGlowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Consult Banner — pinned footer, floats above the scroll content
  consultBanner: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
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
    color: colors.white,
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
