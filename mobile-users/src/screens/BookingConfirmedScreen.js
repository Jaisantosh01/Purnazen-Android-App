import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import useTheme from '../hooks/useTheme';
import { doctorInitial } from '../utils/doctorAvatar';

const BookingConfirmedScreen = ({ navigation, route }) => {
  const { doctor, date, time, visitType, fee, bookingRef, appointmentId } = route.params;
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <View style={styles.iconCircle}>
          <MCIcon name="check-bold" size={36} color={colors.primary} />
        </View>

        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Your appointment has been successfully scheduled</Text>

        <View style={styles.card}>
          <View style={styles.doctorRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarIcon}>{doctorInitial(doctor.name)}</Text>
            </View>
            <View>
              <Text style={styles.doctorName}>{doctor.name}</Text>
              <Text style={styles.doctorSpecialty}>
                {Array.isArray(doctor.specialties) ? doctor.specialties.join(', ') : doctor.specialty || ''}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <MCIcon name="calendar-blank-outline" size={18} color={colors.primary} style={styles.detailIcon} />
            <View>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{date}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MCIcon name="clock-outline" size={18} color={colors.primary} style={styles.detailIcon} />
            <View>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{time}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MCIcon name="stethoscope" size={18} color={colors.primary} style={styles.detailIcon} />
            <View>
              <Text style={styles.detailLabel}>Visit Type</Text>
              <Text style={styles.detailValue}>{visitType}</Text>
            </View>
          </View>

          {bookingRef ? (
            <View style={styles.detailRow}>
              <MCIcon name="bookmark-outline" size={18} color={colors.primary} style={styles.detailIcon} />
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
          <Text style={styles.payBtnText}>Proceed to Payment</Text>
          <MCIcon name="arrow-right" size={18} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>

        <View style={styles.noteCard}>
          <MCIcon name="lightbulb-on-outline" size={16} color={colors.primary} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            You will receive a confirmation email and SMS with joining details
          </Text>
        </View>

      </ScrollView>
    </View>
  );
};

export default BookingConfirmedScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  checkIcon: { fontSize: 36, color: colors.primary },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: colors.black,
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
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 22, fontWeight: '800', color: colors.primary },
  doctorName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  doctorSpecialty: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.surfaceMuted, marginBottom: 14 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  detailIcon: { fontSize: 18, marginTop: 2, color: colors.primary },
  detailLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  payBtn: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  payBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  homeBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  homeBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  noteCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.primaryFaint,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  noteIcon: { fontSize: 16 },
  noteText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
