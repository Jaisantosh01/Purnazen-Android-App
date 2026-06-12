import React, { useEffect, useState } from 'react';
import { STRINGS } from '../constants/strings';
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
import QuickCard from '../components/QuickCards';
import httpInterceptor from '../interceptors/httpInterceptor';
import { BASE_URL, ENDPOINTS } from '../constants/apiEndpoints';



const FALLBACK_WELLNESS = [
  { key: 'YogaSession', title: 'Yoga', duration: '15 min', icon: 'yoga' },
  { key: 'MeditationSession', title: 'Meditation', duration: '10 min', icon: 'meditation' },
  { key: 'BreathingSession', title: 'Breathing', duration: '5 min', icon: 'lungs' },
];

const HomeScreen = ({ navigation }) => {
  const [quickRelief, setQuickRelief] = useState([]);
  const [wellness, setWellness] = useState(FALLBACK_WELLNESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        setLoading(true);

        console.log('QUICK_RELIEF:', BASE_URL + ENDPOINTS.HOME_QUICK_RELIEF);

        const reliefData = await httpInterceptor.get(
          ENDPOINTS.HOME_QUICK_RELIEF
        );

        console.log('Quick Relief Response:', reliefData);

        if (reliefData?.data) {
          setQuickRelief(reliefData.data);
        } else {
          setQuickRelief([]);
        }

      } catch (error) {
        console.log('Home Screen Error:', error);
        setQuickRelief([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.title}></Text>
          <Text style={styles.subtitle}></Text>

          <TouchableOpacity style={styles.banner} activeOpacity={0.9}>
            <Text style={styles.bannerIcon}>✨</Text>
            <View>
              <Text style={styles.bannerTitle}></Text>
              <Text style={styles.bannerSub}></Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Quick Relief ── */}
        <View style={styles.grid}>
          {quickRelief.map(item => (
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
          ))}
        </View>

        {/* ── Wellness ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}></Text>
            <TouchableOpacity onPress={() => navigation.navigate('WellnessTab')}>
              <Text style={styles.seeAll}></Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color="#1FA77A" style={{ marginVertical: 20 }} />
          ) : (
            wellness.map((item, index) => (
              <TouchableOpacity
                key={item.key ?? index}
                style={styles.wellnessRow}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('SessionScreen', { sessionKey: item.key })}
              >
                <MCIcon name={item.icon} size={28} color="#1FA77A" style={styles.wellnessIcon} />
                <View style={styles.wellnessInfo}>
                  <Text style={styles.wellnessTitle}>{item.title}</Text>
                  <Text style={styles.wellnessDuration}>{item.duration}</Text>
                </View>
                <View style={styles.videoBtn}>
                  <MCIcon name="video-outline" size={18} color="#1FA77A" />
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Face Glow Card */}
          <TouchableOpacity
            style={styles.faceGlowCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('FaceGlow')}
          >
            <View style={styles.faceGlowLeft}>
              <View style={styles.faceGlowIconCircle}>
                <MCIcon name="star-four-points-outline" size={22} color="#fff" />
              </View>
              <View>
                <Text style={styles.faceGlowTitle}></Text>
                <Text style={styles.faceGlowSub}></Text>
              </View>
            </View>
            <Text style={styles.faceGlowArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ── Book a Consultation ── */}
        <TouchableOpacity style={styles.consultBanner} activeOpacity={0.88} onPress={() => navigation.navigate('ConsultTab')}>
          <View style={styles.consultLeft}>
            <MCIcon name="calendar-month-outline" size={22} color="#fff" style={styles.consultIcon} />
            <View>
              <Text style={styles.consultTitle}></Text>
              <Text style={styles.consultSub}></Text>
            </View>
          </View>
          <View style={styles.consultArrowCircle}>
            <MCIcon name="arrow-right" size={18} color="#fff" />
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
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: '#1FA77A',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 26,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  bannerTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  bannerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
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
    color: '#111',
  },
  seeAll: {
    fontSize: 13,
    color: '#1FA77A',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wellnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  wellnessIcon: {
    marginRight: 12,
  },
  wellnessInfo: {
    flex: 1,
  },
  wellnessTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  wellnessDuration: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  videoBtn: {
    backgroundColor: '#e8f8f2',
    borderRadius: 10,
    padding: 8,
  },
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
    borderRadius: 22,
    backgroundColor: '#e8a0c0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  faceGlowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  faceGlowSub: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  faceGlowArrow: {
    fontSize: 18,
    color: '#d4789a',
  },
  consultBanner: {
    backgroundColor: '#1FA77A',
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 10,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  consultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consultIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  consultTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  consultSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  consultArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consultArrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});