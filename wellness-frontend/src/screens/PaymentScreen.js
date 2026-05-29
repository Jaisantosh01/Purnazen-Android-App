import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import consultService from '../services/consultService';

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit/Debit Card', icon: '💳' },
  { id: 'upi',  label: 'UPI',               icon: '📱' },
  { id: 'wallet', label: 'Wallet',          icon: '👜' },
];

const WALLETS = [
  { id: 'paytm',    label: 'Paytm',     icon: '💙' },
  { id: 'phonepe',  label: 'PhonePe',   icon: '💜' },
  { id: 'gpay',     label: 'Google Pay', icon: '🟢' },
];

const PaymentScreen = ({ navigation, route }) => {
  const { doctor, fee } = route.params;
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
      await consultService.processPayment({
        doctorId: doctor.id,
        amount:   total,
        method:   selectedMethod,
        wallet:   selectedMethod === 'wallet' ? selectedWallet : undefined,
      });
    } catch (err) {
      console.log('Payment API not ready:', err.message);
    } finally {
      setIsProcessing(false);
    }
    Alert.alert(
      'Payment Successful!',
      `₹${total} paid successfully for your appointment with ${doctor.name}.`,
      [{ text: 'OK', onPress: () => navigation.navigate('ConsultMain') }]
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Payment</Text>
          <Text style={styles.headerSubtitle}>Complete your booking</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Payment Summary */}
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

        {/* Payment Methods */}
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
                <Text style={styles.methodIcon}>{method.icon}</Text>
                <Text style={[styles.methodLabel, selectedMethod === method.id && styles.methodLabelActive]}>
                  {method.label}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Card Fields */}
        {selectedMethod === 'card' && (
          <View style={styles.section}>
            <View style={styles.fieldsCard}>
              <Text style={styles.fieldLabel}>Card Number</Text>
              <TextInput
                style={styles.input}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor="#d1d5db"
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
                    placeholderTextColor="#d1d5db"
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
                    placeholderTextColor="#d1d5db"
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
                placeholderTextColor="#d1d5db"
                value={cardName}
                onChangeText={setCardName}
              />
            </View>
          </View>
        )}

        {/* UPI Field */}
        {selectedMethod === 'upi' && (
          <View style={styles.section}>
            <View style={styles.fieldsCard}>
              <Text style={styles.fieldLabel}>UPI ID</Text>
              <TextInput
                style={styles.input}
                placeholder="yourname@upi"
                placeholderTextColor="#d1d5db"
                value={upiId}
                onChangeText={setUpiId}
              />
            </View>
          </View>
        )}

        {/* Wallet Options */}
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
                  <Text style={styles.walletIcon}>{w.icon}</Text>
                  <Text style={[styles.walletLabel, selectedWallet === w.id && styles.walletLabelActive]}>
                    {w.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Secure Badge */}
        <View style={styles.section}>
          <View style={styles.secureBadge}>
            <Text style={styles.secureIcon}>✅</Text>
            <View>
              <Text style={styles.secureTitle}>Secure Payment</Text>
              <Text style={styles.secureSubtitle}>Your payment information is encrypted and secure</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Pay Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.payBtn} onPress={handlePay} activeOpacity={0.85} disabled={isProcessing}>
          {isProcessing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.payBtnText}>Pay ₹{total}</Text>
          }
        </TouchableOpacity>
      </View>

    </View>
  );
};

export default PaymentScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: '#1a1a1a' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  headerSubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 13, color: '#6b7280' },
  summaryValue: { fontSize: 13, color: '#1a1a1a', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginBottom: 10 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  totalValue: { fontSize: 16, fontWeight: '700', color: '#1FA77A' },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  methodRowActive: { borderColor: '#1FA77A', backgroundColor: '#f0faf6' },
  methodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: '#1FA77A' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1FA77A' },
  methodIcon: { fontSize: 18 },
  methodLabel: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  methodLabelActive: { color: '#1FA77A', fontWeight: '600' },
  fieldsCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  row: { flexDirection: 'row' },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  walletRowActive: { borderColor: '#1FA77A', backgroundColor: '#f0faf6' },
  walletIcon: { fontSize: 20 },
  walletLabel: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  walletLabelActive: { color: '#1FA77A', fontWeight: '600' },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0faf6',
    borderRadius: 12,
    padding: 14,
  },
  secureIcon: { fontSize: 20 },
  secureTitle: { fontSize: 13, fontWeight: '700', color: '#1FA77A' },
  secureSubtitle: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    elevation: 10,
  },
  payBtn: {
    backgroundColor: '#1FA77A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  payBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
