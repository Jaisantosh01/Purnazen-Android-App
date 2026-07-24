import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { showAlert, showConfirm } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import subscriptionService from '../services/subscriptionService';

// Offline/first-paint fallback — mirrors the seeded backend catalog so the
// screen is never blank while the network request is in flight.
const DEFAULT_PLANS = [
  {
    code: 'free', name: 'Free', price: 0, currency: 'INR', period: 'forever',
    badge: null, accentColor: null, sortOrder: 0,
    features: [
      { text: '3 wellness sessions/month', included: true },
      { text: 'Basic yoga & meditation', included: true },
      { text: 'Quick relief guides', included: true },
      { text: 'Doctor consultations', included: false },
      { text: 'Personalized health plan', included: false },
      { text: 'Priority support', included: false },
    ],
  },
  {
    code: 'premium', name: 'Premium', price: 499, currency: 'INR', period: 'month',
    badge: 'Most Popular', accentColor: '#1FA77A', sortOrder: 1,
    features: [
      { text: 'Unlimited wellness sessions', included: true },
      { text: 'All yoga & meditation programs', included: true },
      { text: 'Quick relief guides', included: true },
      { text: '2 doctor consultations/month', included: true },
      { text: 'Personalized health plan', included: true },
      { text: 'Priority support', included: false },
    ],
  },
  {
    code: 'pro', name: 'Pro', price: 999, currency: 'INR', period: 'month',
    badge: null, accentColor: '#7C3AED', sortOrder: 2,
    features: [
      { text: 'Unlimited wellness sessions', included: true },
      { text: 'All yoga & meditation programs', included: true },
      { text: 'Quick relief guides', included: true },
      { text: 'Unlimited consultations', included: true },
      { text: 'Personalized health plan', included: true },
      { text: 'Priority 24/7 support', included: true },
    ],
  },
];

const CURRENCY_SYMBOL = { INR: '₹', USD: '$', EUR: '€' };

const priceLabel = (plan) => `${CURRENCY_SYMBOL[plan.currency] || ''}${plan.price}`;
const periodLabel = (plan) => (plan.period === 'forever' ? 'Forever' : `/${plan.period}`);

// #RRGGBB → rgba() so a plan's accent doubles as a soft, smooth card wash.
const hexToRgba = (hex, a) => {
  if (!hex) return `rgba(0,0,0,${a})`;
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const SubscriptionsScreen = () => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null); // plan code in flight

  // Resolve a plan's card/text colours. The free plan reads as a neutral,
  // theme-aware surface (its old fixed slate wash looked muddy, especially in
  // dark mode); paid plans get a soft wash derived from their own accent so
  // every card feels part of the same system.
  const presentation = useCallback((plan) => {
    const isFree = plan.code === 'free' || !plan.accentColor;
    const accent = isFree ? colors.textSecondary : plan.accentColor;
    return {
      accent,
      bg: isFree ? colors.surfaceMuted : hexToRgba(plan.accentColor, isDark ? 0.13 : 0.08),
      border: isFree ? colors.border : plan.accentColor,
    };
  }, [colors, isDark]);

  const loadCurrent = useCallback(async () => {
    try {
      const sub = await subscriptionService.getCurrent();
      if (sub?.planCode) setCurrentPlan(sub.planCode);
    } catch (e) {
      // keep the last known plan (defaults to free)
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [fetchedPlans] = await Promise.all([
          subscriptionService.getPlans(),
          loadCurrent(),
        ]);
        if (alive && Array.isArray(fetchedPlans) && fetchedPlans.length) {
          setPlans(fetchedPlans.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
        }
      } catch (e) {
        // fall back to DEFAULT_PLANS already in state
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [loadCurrent]);

  const currentName = plans.find(p => p.code === currentPlan)?.name ?? 'Free';

  const handleSubscribe = (plan) => {
    showConfirm(
      `Switch to ${plan.name}?`,
      plan.price > 0
        ? `You'll move to the ${plan.name} plan at ${priceLabel(plan)}${periodLabel(plan)}.`
        : `You'll move to the ${plan.name} plan.`,
      async () => {
        setSubscribing(plan.code);
        try {
          const sub = await subscriptionService.subscribe(plan.code);
          setCurrentPlan(sub?.planCode ?? plan.code);
          showAlert('Success', `You're now on the ${plan.name} plan.`);
        } catch (err) {
          showAlert('Error', err?.response?.data?.message || err?.message || 'Could not update your plan.');
        } finally {
          setSubscribing(null);
        }
      },
      { confirmLabel: plan.price > 0 ? 'Upgrade' : 'Switch' },
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Subscriptions" subtitle="Choose the right plan for you" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        <View style={styles.currentBanner}>
          <MCIcon name="shield-check" size={20} color={colors.primary} />
          <Text style={styles.currentBannerText}>
            You're on the{' '}
            <Text style={styles.currentBannerPlan}>{currentName} Plan</Text>
          </Text>
          {loading ? <ActivityIndicator size="small" color={colors.primary} style={styles.bannerSpinner} /> : null}
        </View>

        {plans.map(plan => {
          const p = presentation(plan);
          const isCurrent = currentPlan === plan.code;
          const isBusy = subscribing === plan.code;
          return (
            <View
              key={plan.code}
              style={[
                styles.planCard,
                { borderColor: p.border, backgroundColor: p.bg },
                isCurrent && styles.planCardActive,
              ]}
            >
              {plan.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              ) : null}

              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, { color: p.accent }]}>{plan.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={[styles.planPrice, { color: p.accent }]}>{priceLabel(plan)}</Text>
                    <Text style={styles.planPeriod}>{periodLabel(plan)}</Text>
                  </View>
                </View>
                {isCurrent ? (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Current</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.featureList}>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <MCIcon
                      name={f.included ? 'check-circle' : 'close-circle-outline'}
                      size={18}
                      color={f.included ? p.accent : colors.borderStrong}
                    />
                    <Text style={[styles.featureText, !f.included && styles.featureTextDim]}>
                      {f.text}
                    </Text>
                  </View>
                ))}
              </View>

              {!isCurrent ? (
                <TouchableOpacity
                  style={[styles.selectBtn, { backgroundColor: p.accent }, subscribing && styles.selectBtnBusy]}
                  activeOpacity={0.85}
                  disabled={!!subscribing}
                  onPress={() => handleSubscribe(plan)}
                >
                  {isBusy
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.selectBtnText}>Get {plan.name}</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}

        <View style={styles.note}>
          <MCIcon name="information-outline" size={14} color={colors.textMuted} />
          <Text style={styles.noteText}>
            {'  '}All paid plans include a 7-day free trial. Cancel anytime.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
};

export default SubscriptionsScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16 },

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
  currentBannerText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  currentBannerPlan: { fontWeight: '700', color: colors.primary },
  bannerSpinner: { marginLeft: 4 },

  planCard: {
    borderRadius: 18,
    borderWidth: 2,
    padding: 18,
    marginTop: 16,
  },
  planCardActive: {
    borderColor: colors.primary,
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
  featureText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  featureTextDim: { color: colors.textMuted, textDecorationLine: 'line-through' },

  selectBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    marginTop: 4,
  },
  selectBtnBusy: { opacity: 0.7 },
  selectBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },

  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  noteText: { fontSize: 12, color: colors.textMuted },
});
