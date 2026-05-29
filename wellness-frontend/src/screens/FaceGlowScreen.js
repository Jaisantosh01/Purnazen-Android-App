import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { ROUTINES, BENEFITS } from '../data/faceGlowData';

const FaceGlowScreen = ({ navigation }) => {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#C850C0" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Face Glow</Text>
            <Text style={styles.headerSubtitle}>Radiant skin routine</Text>
          </View>

          {/* ── Scan Card ── */}
          <View style={styles.scanCard}>
            <View style={styles.scanLeft}>
              <View style={styles.cameraCircle}>
                <Text style={styles.cameraIcon}>📷</Text>
              </View>
              <View>
                <Text style={styles.scanTitle}>Scan Your Face</Text>
                <Text style={styles.scanSubtitle}>
                  Get personalized recommendations
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.scanBtn}
              activeOpacity={0.85}
              onPress={() => Alert.alert('Face Analysis', 'Coming soon!')}
            >
              <Text style={styles.scanBtnText}>Start Face Analysis</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recommended Routines ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Recommended Routines</Text>

          {ROUTINES.map((routine) => (
            <View key={routine.id} style={styles.routineCard}>
              <View style={styles.routineTop}>
                <Text style={styles.routineIcon}>{routine.icon}</Text>
                <View style={styles.routineInfo}>
                  <View style={styles.routineTitleRow}>
                    <Text style={styles.routineTitle}>{routine.title}</Text>
                    <Text style={styles.routineDuration}>
                      🕐 {routine.duration}
                    </Text>
                  </View>
                  {routine.benefits.map((benefit, i) => (
                    <Text key={i} style={styles.benefitItem}>
                      • {benefit}
                    </Text>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={() => Alert.alert(routine.title, 'Starting routine!')}
                >
                  <Text style={styles.playIcon}>▶</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* ── Benefits of Face Acupressure ── */}
        <View style={styles.section}>
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Benefits of Face Acupressure</Text>
            <View style={styles.benefitsGrid}>
              {BENEFITS.map((benefit) => (
                <View key={benefit.id} style={styles.benefitBox}>
                  <Text style={styles.benefitIcon}>{benefit.icon}</Text>
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
    backgroundColor: '#f5f5f5',
  },

  // Header
  header: {
    background: '#C850C0',
    backgroundColor: '#C850C0',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    // Gradient simulation with overlay
    backgroundImage: 'linear-gradient(135deg, #C850C0, #4158D0)',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  backIcon: {
    fontSize: 22,
    color: '#fff',
  },
  headerText: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Scan Card
  scanCard: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 16,
  },
  scanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cameraCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cameraIcon: {
    fontSize: 22,
  },
  scanTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  scanSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  scanBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scanBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C850C0',
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 14,
  },

  // Routine Cards
  routineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  routineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  routineDuration: {
    fontSize: 12,
    color: '#9ca3af',
  },
  benefitItem: {
    fontSize: 13,
    color: '#6b7280',
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
  playIcon: {
    fontSize: 14,
    color: '#C850C0',
  },

  // Benefits Card
  benefitsCard: {
    backgroundColor: '#fdf4ff',
    borderRadius: 16,
    padding: 16,
  },
  benefitsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 14,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    color: '#1a1a1a',
  },
});