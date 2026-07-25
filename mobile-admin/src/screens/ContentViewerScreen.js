import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { renderRichText } from '../utils/richText';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const CONTENT_TYPES = {
  faq: { title: 'FAQ', icon: 'frequently-asked-questions', subtitle: 'Frequently asked questions' },
  terms: { title: 'Terms & Conditions', icon: 'file-document-outline', subtitle: 'Terms of service' },
  privacy: { title: 'Privacy Policy', icon: 'shield-lock-outline', subtitle: 'Data privacy notice' },
};

const ContentViewerScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { type } = route.params;
  const meta = CONTENT_TYPES[type] || CONTENT_TYPES.faq;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (type === 'faq') {
        const res = await apiClient.get(ENDPOINTS.SUPPORT_FAQS);
        setData(Array.isArray(res) ? res : []);
      } else {
        const rolesRes = await apiClient.get(ENDPOINTS.ROLES);
        const roles = Array.isArray(rolesRes?.data) ? rolesRes.data : [];
        const adminRole = roles.find(r => r.name?.toLowerCase() === 'admin');
        const params = { type, is_active: true };
        if (adminRole?.id) params.role_id = adminRole.id;
        const contentRes = await apiClient.get(ENDPOINTS.CONTENT_PAGES, { params });
        const items = Array.isArray(contentRes?.data) ? contentRes.data : [];
        setData(items);
        setVersion(items[0]?.version || null);
      }
    } catch {
      setData([]);
      setVersion(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={meta.title}
        subtitle={meta.subtitle}
        subtitleRight={version ? `v${version}` : null}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : type === 'faq' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={[colors.primary]} tintColor={colors.primary} />}>
          {data.length === 0 ? (
            <Text style={styles.emptyText}>No FAQs available</Text>
          ) : (
            data.map((item) => {
              const isExpanded = expandedIds[item.id];
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.faqCard}
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(item.id)}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion} numberOfLines={isExpanded ? undefined : 2}>{item.question}</Text>
                    <MCIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                  </View>
                  {isExpanded && (
                    <View style={styles.faqBody}>
                      <Text style={styles.faqAnswer}>{item.answer}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={[colors.primary]} tintColor={colors.primary} />}>
          {data.length === 0 ? (
            <Text style={styles.emptyText}>No data</Text>
          ) : (
            data.map((item) => (
              <View key={item.id} style={styles.contentCard}>
                {item.content && (
                  <View style={styles.contentBody}>
                    {renderRichText(item.content, colors)}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 32 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, color: colors.textMuted },

  faqCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 },
  faqBody: { paddingHorizontal: 14, paddingBottom: 14 },
  faqAnswer: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  contentCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  contentBody: { marginTop: 4 },
});

export default ContentViewerScreen;
