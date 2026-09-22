import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import consultService from '../services/consultService';
import { useAuthStore } from '../store/authStore';
import useTheme from '../hooks/useTheme';
import useTaxConfig from '../hooks/useTaxConfig';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import { appointmentBreakdown, formatRupees, gstLabel } from '../utils/tax';

// Everything the checkout offers (cards, UPI, netbanking, wallets, EMI, pay
// later) is decided by the Razorpay account, so the sheet is the method
// picker; the app only opens it against the order the backend created.
const METHODS = [
  { icon: 'cellphone',           label: 'UPI' },
  { icon: 'credit-card-outline', label: 'Cards' },
  { icon: 'bank-outline',        label: 'Netbanking' },
  { icon: 'wallet-outline',      label: 'Wallets' },
  { icon: 'calendar-clock',      label: 'EMI' },
];

// Android SDK codes surfaced by react-native-razorpay's rejection.
const RZP_PAYMENT_CANCELLED = 0;
const RZP_NETWORK_ERROR = 2;

const isCancelled = err =>
  err?.code === RZP_PAYMENT_CANCELLED || /cancel/i.test(err?.description ?? '');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09-25" + "Thursday" → "Thu, 25 Sep 2026". Falls back to the raw value. */
export const formatAppointmentDate = (isoDate, dayName) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? '');
  if (!m) return isoDate ?? '';
  const day = dayName ? `${dayName.slice(0, 3)}, ` : '';
  return `${day}${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
};

const PaymentScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { doctor, fee, appointment, appointmentId } = route.params;

  // The rate is admin-configured, so it is read off the booked appointment
  // rather than assumed. The live config is only a fallback for appointments
  // booked before GST existed, and the backend charges whatever the row says
  // regardless — these figures exist to show the patient the same number.
  const { gstPercentage } = useTaxConfig();
  const charges = useMemo(
    () => appointmentBreakdown(appointment ?? { fee }, gstPercentage ?? 0),
    [appointment, fee, gstPercentage],
  );
  const total = charges.total;
  const showsGst = charges.gstPercentage > 0;

  const when = formatAppointmentDate(appointment?.date, appointment?.day);
  const slot = appointment?.time
    ? `${appointment.time}${appointment.endTime ? ` – ${appointment.endTime}` : ''}`
    : null;
  const visitType = appointment?.consultationType ?? route.params.visitType;

  const user = useAuthStore(state => state.user);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      // 1. Create the payment order
      const order = await consultService.processPayment({
        appointmentId,
        doctorId: doctor.id,
        amount:   total,
      });

      // 2. Complete it. Without provider keys the backend runs a local
      //    sandbox and hands us a valid signature pair; with real keys the
      //    Razorpay checkout sheet produces them.
      let result;
      if (order?.sandboxPaymentId) {
        result = {
          orderId:   order.orderId,
          paymentId: order.sandboxPaymentId,
          signature: order.sandboxSignature,
        };
      } else {
        const data = await RazorpayCheckout.open({
          key:         order.keyId,
          order_id:    order.orderId,
          amount:      String(Math.round(order.amount * 100)),
          currency:    order.currency,
          name:        'Purnazen',
          description: `Consultation with ${doctor.name}`,
          prefill: {
            name:    user?.full_name ?? '',
            email:   user?.email ?? '',
            contact: user?.phone ?? '',
          },
          theme: { color: colors.primary },
        });
        result = {
          orderId:   data.razorpay_order_id,
          paymentId: data.razorpay_payment_id,
          signature: data.razorpay_signature,
        };
      }

      // 3. The backend checks the signature before anything is marked paid.
      const verified = await consultService.verifyPayment(result);
      const payment = verified?.payment ?? {};

      // The booking is only confirmed now, so the confirmation page replaces
      // the checkout: back never returns to a checkout that is already paid.
      navigation.replace('BookingConfirmed', {
        doctor,
        date: when,
        time: slot,
        visitType,
        fee,
        appointment: { ...appointment, paymentStatus: 'paid' },
        bookingRef: appointment?.reference,
        appointmentId,
        payment: {
          amount:    payment.amount ?? total,
          method:    payment.method,
          paymentId: payment.paymentId ?? result.paymentId,
        },
      });
    } catch (err) {
      if (isCancelled(err)) {
        // Closing the sheet is a choice, not a failure.
      } else if (err?.code === RZP_NETWORK_ERROR) {
        showAlert('No connection', 'Could not reach the payment gateway.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handlePay },
        ]);
      } else {
        showAlert('Payment failed', err?.description || err?.message || 'Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Checkout" subtitle="Review and pay to confirm your booking" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* What is being paid for */}
        <View style={styles.card}>
          <View style={styles.doctorRow}>
            <Avatar uri={doctor.avatar} name={doctor.name} size={48} />
            <View style={styles.doctorMeta}>
              <Text style={styles.doctorName} numberOfLines={1}>{doctor.name}</Text>
              <Text style={styles.doctorSpecialty} numberOfLines={1}>
                {Array.isArray(doctor.specialties) ? doctor.specialties.join(', ') : doctor.specialty || ''}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.factsRow}>
            {when ? (
              <View style={styles.fact}>
                <MCIcon name="calendar-blank-outline" size={16} color={colors.primary} />
                <Text style={styles.factText}>{when}</Text>
              </View>
            ) : null}
            {slot ? (
              <View style={styles.fact}>
                <MCIcon name="clock-outline" size={16} color={colors.primary} />
                <Text style={styles.factText}>{slot}</Text>
              </View>
            ) : null}
            {visitType ? (
              <View style={styles.fact}>
                <MCIcon name="stethoscope" size={16} color={colors.primary} />
                <Text style={styles.factText}>{visitType}</Text>
              </View>
            ) : null}
          </View>
          {appointment?.reference ? (
            <Text style={styles.reference}>Booking ref {appointment.reference}</Text>
          ) : null}
        </View>

        {/* Price details */}
        <Text style={styles.sectionTitle}>Price details</Text>
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Consultation fee</Text>
            <Text style={styles.priceValue}>{formatRupees(charges.base)}</Text>
          </View>
          {showsGst ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{gstLabel(charges.gstPercentage)}</Text>
              <Text style={styles.priceValue}>{formatRupees(charges.gst)}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total payable</Text>
            <Text style={styles.totalValue}>{formatRupees(total)}</Text>
          </View>
        </View>

        {/* Hold notice */}
        <View style={styles.holdNote}>
          <MCIcon name="timer-sand" size={16} color={colors.warning} />
          <Text style={styles.holdText}>
            Your slot is reserved for 15 minutes. The appointment is confirmed once payment completes.
          </Text>
        </View>

        {/* Methods */}
        <Text style={styles.sectionTitle}>Pay with</Text>
        <View style={styles.card}>
          <View style={styles.methodsRow}>
            {METHODS.map(m => (
              <View key={m.label} style={styles.methodChip}>
                <MCIcon name={m.icon} size={16} color={colors.primary} />
                <Text style={styles.methodChipText}>{m.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.methodsHint}>
            You choose the method on Razorpay's secure page. Purnazen never sees your card or UPI details.
          </Text>
        </View>

        <View style={styles.secureRow}>
          <MCIcon name="shield-check" size={16} color={colors.textMuted} />
          <Text style={styles.secureText}>Payments secured by Razorpay · PCI DSS compliant</Text>
        </View>

      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomAmount}>{formatRupees(total)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, isProcessing && styles.payBtnBusy]}
          onPress={handlePay}
          activeOpacity={0.85}
          disabled={isProcessing}
        >
          {isProcessing
            ? <ActivityIndicator color={colors.white} />
            : (
              <>
                <MCIcon name="lock" size={16} color={colors.white} />
                <Text style={styles.payBtnText}>Pay securely</Text>
              </>
            )}
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default PaymentScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 120 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 20, marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  doctorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doctorMeta: { flex: 1 },
  doctorName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  doctorSpecialty: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.surfaceMuted, marginVertical: 14 },
  factsRow: { gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  reference: { fontSize: 11, color: colors.textMuted, marginTop: 12, fontFamily: 'monospace' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  priceLabel: { fontSize: 13, color: colors.textSecondary },
  priceValue: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  totalLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.primary },
  holdNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 12, paddingHorizontal: 4,
  },
  holdText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  methodsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    backgroundColor: colors.primaryFaint, borderWidth: 1, borderColor: colors.primaryLight,
  },
  methodChipText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  methodsHint: { fontSize: 12, color: colors.textSecondary, marginTop: 12, lineHeight: 17 },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  secureText: { fontSize: 11, color: colors.textMuted },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border, elevation: 10,
  },
  bottomLabel: { fontSize: 11, color: colors.textMuted },
  bottomAmount: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28, minWidth: 170, justifyContent: 'center',
  },
  payBtnBusy: { opacity: 0.8 },
  payBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
});
