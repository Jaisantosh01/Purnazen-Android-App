import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'Forever',
    color: '#6B7280',
    bg: 'rgba(148,163,184,0.10)',
    border: 'rgba(148,163,184,0.35)',
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
    bg: 'rgba(31,167,122,0.10)',
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
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.10)',
    border: '#7C3AED',
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useAuthStore(state => state.user);
  const currentPlan = user?.plan ?? 'free';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Subscriptions" subtitle="Choose the right plan for you" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>

        <View style={styles.currentBanner}>
          <MCIcon name="shield-check" size={20} color={colors.primary} />
          <Text style={styles.currentBannerText}>
            You're on the{' '}
            <Text style={{ fontWeight: '700', color: colors.primary }}>
              {PLANS.find(p => p.id === currentPlan)?.name ?? 'Free'} Plan
            </Text>
          </Text>
        </View>

        {PLANS.map(plan => (
          <View
            key={plan.id}
            style={[styles.planCard, { borderColor: plan.border, backgroundColor: plan.bg },
              currentPlan === plan.id && styles.planCardActive,
            ]}
          >
            {plan.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{plan.badge}</Text>
              </View>
            )}

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

            <View style={styles.featureList}>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <MCIcon
                    name={f.included ? 'check-circle' : 'close-circle-outline'}
                    size={18}
                    color={f.included ? plan.color : colors.borderStrong}
                  />
                  <Text style={[styles.featureText, !f.included && styles.featureTextDim]}>
                    {f.text}
                  </Text>
                </View>
              ))}
            </View>

            {currentPlan !== plan.id && (
              <TouchableOpacity
                style={[styles.selectBtn, { backgroundColor: plan.color }]}
                activeOpacity={0.85}
                onPress={() => showAlert(`Upgrade to ${plan.name}`, `You'll be charged ${plan.price}${plan.period}. Proceed?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Upgrade', onPress: () => showAlert('Success', `Upgraded to ${plan.name}!`) },
                ])}
              >
                <Text style={styles.selectBtnText}>Get {plan.name}</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <View style={styles.note}>
          <MCIcon name="information-outline" size={14} color={colors.textMuted} />
          <Text style={styles.noteText}>
            {'  '}All plans include a 7-day free trial. Cancel anytime.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
};

export default SubscriptionsScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    backgroundColor: colors.headerBg,
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
  headerTitle:    { fontSize: 22, fontWeight: '700', color: colors.white },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  currentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
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
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.white },

  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planName:   { fontSize: 18, fontWeight: '700' },
  priceRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 },
  planPrice:  { fontSize: 26, fontWeight: '800' },
  planPeriod: { fontSize: 13, color: colors.textMuted, marginBottom: 3 },

  activePill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activePillText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  featureList: { gap: 10, marginBottom: 16 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, color: '#374151', flex: 1 },
  featureTextDim: { color: colors.borderStrong },

  selectBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  noteText: { fontSize: 12, color: colors.textMuted },
});
