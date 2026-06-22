import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, TextInput, Alert, ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import consultService from '../services/consultService';
import { COLORS } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';

const PAYMENT_METHODS = [
  { id: 'card',   label: 'Credit/Debit Card', icon: 'credit-card-outline' },
  { id: 'upi',    label: 'UPI',               icon: 'cellphone' },
  { id: 'wallet', label: 'Wallet',            icon: 'wallet-outline' },
];

const WALLETS = [
  { id: 'paytm',    label: 'Paytm',      icon: 'wallet' },
  { id: 'phonepe',  label: 'PhonePe',    icon: 'cellphone-check' },
  { id: 'gpay',     label: 'Google Pay', icon: 'google' },
];

const PaymentScreen = ({ navigation, route }) => {
  const { doctor, fee, appointmentId } = route.params;
  const gst = Math.round(fee * 0.18);
  const total = fee + gst;

  const [selectedMethod, setSelectedMethod] = useState('card');
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [cardNumber, setCardNumber]         = useState('');
  const [expiry, setExpiry]                 = useState('');
  const [cvv, setCvv]                       = useState('');
  const [cardName, setCardName]             = useState('');
  const [upiId, setUpiId]                   = useState('');
  const [isProcessing, setIsProcessing]     = useState(false);

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      // 1. Create the payment order
      const order = await consultService.processPayment({
        appointmentId,
        doctorId: doctor.id,
        amount:   total,
        method:   selectedMethod,
        wallet:   selectedMethod === 'wallet' ? selectedWallet : undefined,
      });

      // 2. Complete it. Without provider keys the backend runs a local
      //    sandbox and hands us a valid signature pair; with real keys this
      //    is where the Razorpay checkout SDK would produce them.
      if (order?.sandboxPaymentId) {
        await consultService.verifyPayment({
          orderId:   order.orderId,
          paymentId: order.sandboxPaymentId,
          signature: order.sandboxSignature,
        });
      } else {
        throw new Error('Razorpay checkout is not available in this build yet.');
      }

      Alert.alert(
        'Payment Successful!',
        `₹${total} paid successfully for your appointment with ${doctor.name}.`,
        [{ text: 'OK', onPress: () => navigation.navigate('ConsultMain') }]
      );
    } catch (err) {
      Alert.alert('Payment Failed', err.message || 'Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Payment" subtitle="Complete your booking" variant="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Consultation Fee</Text>
              <Text style={styles.summaryValue}>₹{fee}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>GST (18%)</Text>
              <Text style={styles.summaryValue}>₹{gst}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{total}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Payment Method</Text>
          {PAYMENT_METHODS.map(method => (
            <TouchableOpacity
              key={method.id}
              style={[styles.methodRow, selectedMethod === method.id && styles.methodRowActive]}
              onPress={() => setSelectedMethod(method.id)}
              activeOpacity={0.8}
            >
              <View style={styles.methodLeft}>
                <View style={[styles.radio, selectedMethod === method.id && styles.radioActive]}>
                  {selectedMethod === method.id && <View style={styles.radioDot} />}
                </View>
                <MCIcon name={method.icon} size={20} color={selectedMethod === method.id ? COLORS.primary : COLORS.textSecondary} style={styles.methodIcon} />
                <Text style={[styles.methodLabel, selectedMethod === method.id && styles.methodLabelActive]}>
                  {method.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {selectedMethod === 'card' && (
          <View style={styles.section}>
            <View style={styles.fieldsCard}>
              <Text style={styles.fieldLabel}>Card Number</Text>
              <TextInput
                style={styles.input}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={COLORS.borderStrong}
                keyboardType="numeric"
                maxLength={19}
                value={cardNumber}
                onChangeText={setCardNumber}
              />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.fieldLabel}>Expiry Date</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/YY"
                    placeholderTextColor={COLORS.borderStrong}
                    maxLength={5}
                    value={expiry}
                    onChangeText={setExpiry}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>CVV</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    placeholderTextColor={COLORS.borderStrong}
                    keyboardType="numeric"
                    maxLength={3}
                    secureTextEntry
                    value={cvv}
                    onChangeText={setCvv}
                  />
                </View>
              </View>
              <Text style={styles.fieldLabel}>Cardholder Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={COLORS.borderStrong}
                value={cardName}
                onChangeText={setCardName}
              />
            </View>
          </View>
        )}

        {selectedMethod === 'upi' && (
          <View style={styles.section}>
            <View style={styles.fieldsCard}>
              <Text style={styles.fieldLabel}>UPI ID</Text>
              <TextInput
                style={styles.input}
                placeholder="yourname@upi"
                placeholderTextColor={COLORS.borderStrong}
                value={upiId}
                onChangeText={setUpiId}
              />
            </View>
          </View>
        )}

        {selectedMethod === 'wallet' && (
          <View style={styles.section}>
            <View style={styles.fieldsCard}>
              {WALLETS.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.walletRow, selectedWallet === w.id && styles.walletRowActive]}
                  onPress={() => setSelectedWallet(w.id)}
                  activeOpacity={0.8}
                >
                  <MCIcon name={w.icon} size={20} color={selectedWallet === w.id ? COLORS.primary : COLORS.textSecondary} style={styles.walletIcon} />
                  <Text style={[styles.walletLabel, selectedWallet === w.id && styles.walletLabelActive]}>
                    {w.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.secureBadge}>
            <MCIcon name="shield-check" size={20} color={COLORS.primary} style={styles.secureIcon} />
            <View>
              <Text style={styles.secureTitle}>Secure Payment</Text>
              <Text style={styles.secureSubtitle}>Your payment information is encrypted and secure</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} activeOpacity={0.85} disabled={isProcessing}>
          {isProcessing
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.payBtnText}>Pay ₹{total}</Text>
          }
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default PaymentScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceMuted,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: COLORS.textPrimary },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 12 },
  summaryCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, elevation: 1,
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: COLORS.textSecondary },
  summaryValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.surfaceMuted, marginBottom: 10 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  totalValue: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  methodRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaint },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  methodIcon: { fontSize: 18 },
  methodLabel: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  methodLabelActive: { color: COLORS.primary, fontWeight: '600' },
  fieldsCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, elevation: 1,
    shadowColor: COLORS.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: COLORS.textPrimary, backgroundColor: '#fafafa',
  },
  row: { flexDirection: 'row' },
  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10,
  },
  walletRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryFaint },
  walletIcon:  { fontSize: 20 },
  walletLabel: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  walletLabelActive: { color: COLORS.primary, fontWeight: '600' },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.primaryFaint, borderRadius: 12, padding: 14,
  },
  secureIcon:     { fontSize: 20 },
  secureTitle:    { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  secureSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.surfaceMuted, elevation: 10,
  },
  payBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  payBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.white },
});
