import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'Forever',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    features: [
      { text: '3 wellness sessions/month',  included: true  },
      { text: 'Basic yoga & meditation',     included: true  },
      { text: 'Quick relief guides',         included: true  },
      { text: 'Doctor consultations',        included: false },
      { text: 'Personalized health plan',    included: false },
      { text: 'Priority support',            included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹499',
    period: '/month',
    badge: 'Most Popular',
    color: '#1FA77A',
    bg: '#f0faf6',
    border: '#1FA77A',
    features: [
      { text: 'Unlimited wellness sessions', included: true },
      { text: 'All yoga & meditation programs', included: true },
      { text: 'Quick relief guides',          included: true },
      { text: '2 doctor consultations/month', included: true },
      { text: 'Personalized health plan',     included: true },
      { text: 'Priority support',             included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹999',
    period: '/month',
    color: '#7c3aed',
    bg: '#F3EEFF',
    border: '#7c3aed',
    features: [
      { text: 'Unlimited wellness sessions', included: true },
      { text: 'All yoga & meditation programs', included: true },
      { text: 'Quick relief guides',          included: true },
      { text: 'Unlimited consultations',      included: true },
      { text: 'Personalized health plan',     included: true },
      { text: 'Priority 24/7 support',        included: true },
    ],
  },
];

const SubscriptionsScreen = ({ navigation }) => {
  const [currentPlan] = useState('free');

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Subscriptions</Text>
          <Text style={styles.headerSubtitle}>Choose the right plan for you</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>

        {/* Current Plan Banner */}
        <View style={styles.currentBanner}>
          <MCIcon name="shield-check" size={20} color="#1FA77A" />
          <Text style={styles.currentBannerText}>
            You're on the <Text style={{ fontWeight: '700', color: '#1FA77A' }}>Free Plan</Text>
          </Text>
        </View>

        {/* Plans */}
        {PLANS.map(plan => (
          <View
            key={plan.id}
            style={[styles.planCard, { borderColor: plan.border, backgroundColor: plan.bg },
              currentPlan === plan.id && styles.planCardActive,
            ]}
          >
            {/* Badge */}
            {plan.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{plan.badge}</Text>
              </View>
            )}

            {/* Plan Header */}
            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.planPrice, { color: plan.color }]}>{plan.price}</Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>
              {currentPlan === plan.id && (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Current</Text>
                </View>
              )}
            </View>

            {/* Features */}
            <View style={styles.featureList}>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <MCIcon
                    name={f.included ? 'check-circle' : 'close-circle-outline'}
                    size={18}
                    color={f.included ? plan.color : '#d1d5db'}
                  />
                  <Text style={[styles.featureText, !f.included && styles.featureTextDim]}>
                    {f.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Button */}
            {currentPlan !== plan.id && (
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: plan.color }]}
                activeOpacity={0.85}
                onPress={() => Alert.alert(`Upgrade to ${plan.name}`, `You'll be charged ${plan.price}${plan.period}. Proceed?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Upgrade', onPress: () => Alert.alert('Success', `Upgraded to ${plan.name}!`) },
                ])}
              >
                <Text style={styles.selectBtnText}>Get {plan.name}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Note */}
        <View style={styles.note}>
          <MCIcon name="information-outline" size={14} color="#9ca3af" />
          <Text style={styles.noteText}>
            {'  '}All plans include a 7-day free trial. Cancel anytime.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
};

export default SubscriptionsScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#1FA77A',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle:    { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  currentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f8f2',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    marginBottom: 4,
    gap: 8,
  },
  currentBannerText: { fontSize: 13, color: '#374151' },

  planCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    marginTop: 16,
  },
  planCardActive: {
    shadowColor: '#1FA77A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1FA77A',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planName:   { fontSize: 18, fontWeight: '700' },
  priceRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 },
  planPrice:  { fontSize: 26, fontWeight: '800' },
  planPeriod: { fontSize: 13, color: '#9ca3af', marginBottom: 3 },

  activePill: {
    backgroundColor: '#e8f8f2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activePillText: { fontSize: 12, fontWeight: '600', color: '#1FA77A' },

  featureList: { gap: 10, marginBottom: 16 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, color: '#374151', flex: 1 },
  featureTextDim: { color: '#d1d5db' },

  selectBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  noteText: { fontSize: 12, color: '#9ca3af' },
});
