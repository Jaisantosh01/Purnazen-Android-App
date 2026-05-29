import React from 'react';
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

const QUICK_RELIEF_ITEMS = [
  { title: 'Headache', icon: 'brain',           bg: '#EEF2FF', color: '#4f46e5', sub: '#818cf8' },
  { title: 'Neck Pain', icon: 'lightning-bolt', bg: '#F5F0FF', color: '#7c3aed', sub: '#a78bfa' },
  { title: 'Back Pain', icon: 'fire',           bg: '#FFF3E0', color: '#ea580c', sub: '#fb923c' },
  { title: 'Stress',    icon: 'weather-windy',  bg: '#E8FDF5', color: '#0d9488', sub: '#2dd4bf' },
  { title: 'Anxiety',   icon: 'heart-outline',  bg: '#FFF0F3', color: '#e11d48', sub: '#fb7185' },
  { title: 'Sleep',     icon: 'sleep',          bg: '#F0F9FF', color: '#0284c7', sub: '#38bdf8' },
];

const WELLNESS_ITEMS = [
  { title: 'Yoga',       duration: '15 min', icon: 'yoga'         },
  { title: 'Meditation', duration: '10 min', icon: 'meditation'   },
  { title: 'Breathing',  duration: '5 min',  icon: 'lungs'        },
];

const HomeScreen = ({ navigation }) => {
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
          <Text style={styles.title}>PurnaZen</Text>
          <Text style={styles.subtitle}>Your wellness companion</Text>

          <TouchableOpacity style={styles.banner} activeOpacity={0.9}>
            <Text style={styles.bannerIcon}>✨</Text>
            <View>
              <Text style={styles.bannerTitle}>How are you feeling today?</Text>
              <Text style={styles.bannerSub}>Let's find relief together</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Quick Relief ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Relief</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SelectSymptom')}>
             <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {QUICK_RELIEF_ITEMS.map((item, index) => (
              <QuickCard
                key={index}
                title={item.title}
                iconName={item.icon}
                bg={item.bg}
                color={item.color}
                sub={item.sub}
                onPress={() => navigation.navigate('ReliefSession', { reliefKey: item.title })}
              />
            ))}
          </View>
        </View>

        {/* ── Wellness ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Wellness</Text>
            <TouchableOpacity onPress={() => navigation.navigate('WellnessTab')}>
              <Text style={styles.seeAll}>Explore →</Text>
            </TouchableOpacity>
          </View>

          {WELLNESS_ITEMS.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.wellnessRow}
              activeOpacity={0.85}
              onPress={() => {
                if (item.title === 'Yoga') {
                  navigation.navigate('SessionScreen', { sessionKey: 'YogaSession' });
                } else if (item.title === 'Meditation') {
                  navigation.navigate('SessionScreen', { sessionKey: 'MeditationSession' });
                } else if (item.title === 'Breathing') {
                  navigation.navigate('SessionScreen', { sessionKey: 'BreathingSession' });
                }
              }}
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
          ))}

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
                <Text style={styles.faceGlowTitle}>Face Glow</Text>
                <Text style={styles.faceGlowSub}>Radiant skin routine</Text>
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
              <Text style={styles.consultTitle}>Book a Consultation</Text>
              <Text style={styles.consultSub}>Connect with expert doctors</Text>
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
  videoBtnIcon: {
    fontSize: 16,
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