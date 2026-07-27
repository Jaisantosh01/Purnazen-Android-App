import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import SkeletonBox from '../components/SkeletonLoader';
import TabHeader from '../components/TabHeader';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';
import { reliefCardColors } from '../utils/cardTheme';

const ReliefScreen = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems]             = useState([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError]             = useState(null);

  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(ENDPOINTS.HOME_QUICK_RELIEF);
      setItems(res?.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load relief categories');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const CardSkeleton = () => (
    <View style={styles.skeletonCard}>
      <SkeletonBox width={32} height={32} borderRadius={RADIUS.sm} style={{ marginBottom: SPACING.sm }} />
      <SkeletonBox width="70%" height={14} />
      <SkeletonBox width="85%" height={11} style={{ marginTop: SPACING.xs }} />
      <SkeletonBox width="50%" height={11} style={{ marginTop: SPACING.xl }} />
    </View>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <TabHeader
          title="Quick Relief"
          subtitle="Instant acupressure therapy for common issues"
        />

        {/* Grid */}
        {isLoading ? (
          <View style={styles.grid}>
            {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <MCIcon name="alert-circle-outline" size={52} color={colors.danger} />
            <Text style={styles.errorTitle}>Failed to load</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData()} activeOpacity={0.85}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.errorBox}>
            <MCIcon name="heart-outline" size={52} color={colors.border} />
            <Text style={styles.errorTitle}>No relief sessions yet</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => {
              // Same resolution Home's QuickCard uses, so a card looks the same
              // on both screens in either scheme.
              const card = reliefCardColors({
                bg: item.background_color || item.bgColor,
                fg: item.text_color || item.iconColor,
                colors,
                isDark,
              });
              return (
              <TouchableOpacity
                key={item.id || item.key}
                style={[styles.card, { backgroundColor: card.background }]}
                activeOpacity={0.8}
                onPress={() => {
                  if (item.chatQuestionId) {
                    navigation.navigate('ChatAssistant', {
                      startQuestionId: item.chatQuestionId,
                      reliefTitle: item.title,
                    });
                  } else {
                    navigation.navigate('ReliefSession', {
                      reliefKey: item.title || item.key,
                      reliefId: item.id,
                      reliefSlug: item.slug || item.key,
                      reliefTitle: item.title,
                    });
                  }
                }}
              >
                <MCIcon
                  name={item.icon_name || item.icon || 'heart-pulse'}
                  size={32}
                  color={card.accent}
                  style={styles.cardIcon}
                />
                <Text style={[styles.cardTitle, { color: card.title }]}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSubtitle, { color: card.subtitle }]}>{item.subtitle}</Text>
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardCta, { color: card.accent }]}>
                    Start
                  </Text>
                  <MCIcon name="arrow-right" size={16} color={card.accent} />
                </View>
              </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ReliefScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  card: {
    width: '48%',
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: 14,
    minHeight: 168,
    justifyContent: 'space-between',
  },
  skeletonCard: {
    width: '48%',
    borderRadius: 18,
    padding: SPACING.lg,
    marginBottom: 14,
    minHeight: 168,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'space-between',
  },
  cardIcon:     { marginBottom: SPACING.sm },
  cardTitle:    { fontSize: 16, fontWeight: '700', marginBottom: SPACING.xs },
  cardSubtitle: { fontSize: 12, marginBottom: 12, flexShrink: 1 },
  cardFooter:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardCta:      { fontSize: 12, fontWeight: '700' },
  errorBox: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.sm,
  },
  errorTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  errorText:  { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  retryBtn: {
    marginTop: SPACING.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: colors.white },
});
