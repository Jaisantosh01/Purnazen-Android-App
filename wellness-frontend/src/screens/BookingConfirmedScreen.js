import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';

const BookingConfirmedScreen = ({ navigation, route }) => {
  const { doctor, date, time, visitType, fee } = route.params;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Check Icon */}
        <View style={styles.iconCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>

        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Your appointment has been successfully scheduled</Text>

        {/* Doctor Card */}
        <View style={styles.card}>
          <View style={styles.doctorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarIcon}>{doctor.avatar}</Text>
            </View>
            <View>
              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📅</Text>
            <View>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{date}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🕐</Text>
            <View>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{time}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📹</Text>
            <View>
              <Text style={styles.detailLabel}>Visit Type</Text>
              <Text style={styles.detailValue}>{visitType}</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.payBtn}
          onPress={() => navigation.navigate('Payment', { doctor, fee })}
          activeOpacity={0.85}
        >
          <Text style={styles.payBtnText}>Proceed to Payment  →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>

        {/* Note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteIcon}>💡</Text>
          <Text style={styles.noteText}>
            You will receive a confirmation email and SMS with joining details
          </Text>
        </View>

      </ScrollView>
    </View>
  );
};

export default BookingConfirmedScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  container: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f8f2',
    borderWidth: 2,
    borderColor: '#1FA77A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkIcon: { fontSize: 36, color: '#1FA77A' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0faf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 24 },
  doctorName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  doctorSpecialty: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 14 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  detailIcon: { fontSize: 18, marginTop: 2, color: '#1FA77A' },
  detailLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  payBtn: {
    width: '100%',
    backgroundColor: '#1FA77A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  payBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  homeBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  homeBtnText: { fontSize: 15, fontWeight: '600', color: '#1FA77A' },
  noteCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#f0faf6',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  noteIcon: { fontSize: 16 },
  noteText: { flex: 1, fontSize: 12, color: '#6b7280', lineHeight: 18 },
});
