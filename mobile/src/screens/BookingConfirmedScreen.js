import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { COLORS } from '../constants/theme';

const BookingConfirmedScreen = ({ navigation, route }) => {
  const { doctor, date, time, visitType, fee, bookingRef, appointmentId } = route.params;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.iconCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>

        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Your appointment has been successfully scheduled</Text>

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

          {bookingRef ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>🔖</Text>
              <View>
                <Text style={styles.detailLabel}>Booking ID</Text>
                <Text style={styles.detailValue}>{bookingRef}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.payBtn}
          onPress={() => navigation.navigate('Payment', { doctor, fee, appointmentId })}
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
  root: { flex: 1, backgroundColor: COLORS.white },
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
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkIcon: { fontSize: 36, color: COLORS.primary },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    shadowColor: COLORS.black,
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
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 24 },
  doctorName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  doctorSpecialty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.surfaceMuted, marginBottom: 14 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  detailIcon: { fontSize: 18, marginTop: 2, color: COLORS.primary },
  detailLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  payBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  payBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  homeBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  homeBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  noteCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  noteIcon: { fontSize: 16 },
  noteText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
});
