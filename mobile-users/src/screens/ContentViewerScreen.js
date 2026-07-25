import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const CONTENT_TYPES = {
  terms: { title: 'Terms & Conditions', icon: 'file-document-outline', subtitle: 'Terms of service' },
  privacy: { title: 'Privacy Policy', icon: 'shield-lock-outline', subtitle: 'Data privacy notice' },
};

const parseInlineTags = (text, colors) => {
  const parts = [];
  let remaining = text;

  const boldParts = [];
  let boldRest = remaining;
  while (boldRest && boldRest.includes('<b>')) {
    const s = boldRest.split('<b>');
    if (s[0]) boldParts.push(<Text key={`b0_${boldParts.length}`} style={{}}>{s[0]}</Text>);
    const rest = s.slice(1).join('<b>');
    const e = rest.indexOf('</b>');
    if (e === -1) { boldParts.push(<Text key={`b1_${boldParts.length}`} style={{ fontWeight: '700' }}>{rest}</Text>); boldRest = ''; break; }
    boldParts.push(<Text key={`b1_${boldParts.length}`} style={{ fontWeight: '700' }}>{rest.substring(0, e)}</Text>);
    boldRest = rest.substring(e + 4);
  }
  if (boldRest) boldParts.push(<Text key={`b_end`} style={{}}>{boldRest}</Text>);

  const finalParts = [];
  boldParts.forEach((part, i) => {
    const text = part.props.children || '';
    if (typeof text !== 'string') { finalParts.push(part); return; }
    if (text.includes('<i>')) {
      const s = text.split('<i>');
      if (s[0]) finalParts.push(<Text key={`i0_${i}`} style={{}}>{s[0]}</Text>);
      const rest = s.slice(1).join('<i>');
      const e = rest.indexOf('</i>');
      if (e === -1) { finalParts.push(<Text key={`i1_${i}`} style={{ fontStyle: 'italic' }}>{rest}</Text>); }
      else {
        finalParts.push(<Text key={`i1_${i}`} style={{ fontStyle: 'italic' }}>{rest.substring(0, e)}</Text>);
        const after = rest.substring(e + 4);
        if (after) finalParts.push(<Text key={`i2_${i}`} style={{}}>{after}</Text>);
      }
    } else {
      finalParts.push(part);
    }
  });
  return finalParts;
};

const renderStyledContent = (html, colors) => {
  if (!html) return null;
  const elements = [];
  const lines = html.split('\n');
  let listBuffer = [];

  const flushList = (key) => {
    if (listBuffer.length > 0) {
      elements.push(
        <View key={key} style={{ marginLeft: 8, marginBottom: 4 }}>
          {listBuffer.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
              <Text style={{ color: colors.textPrimary, lineHeight: 22, marginRight: 6 }}>{'\u2022'}</Text>
              <Text style={{ color: colors.textPrimary, lineHeight: 22, flex: 1 }}>{item}</Text>
            </View>
          ))}
        </View>
      );
      listBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(`space_${idx}`); return; }
    if (trimmed.startsWith('<li>') || trimmed.startsWith('- ')) {
      const text = trimmed.replace(/<\/?li>/g, '').replace(/<\/?ul>/g, '').replace(/^- /, '').trim();
      listBuffer.push(parseInlineTags(text, colors));
      return;
    }
    if (trimmed === '<ul>' || trimmed === '</ul>') { return; }
    flushList(`list_${idx}`);
    const isH3 = trimmed.startsWith('<h3>') && trimmed.endsWith('</h3>');
    const isSmall = trimmed.startsWith('<small>') && trimmed.endsWith('</small>');
    const displayText = trimmed.replace(/<\/?h3>/g, '').replace(/<\/?small>/g, '');
    const formatted = parseInlineTags(displayText, colors);
    elements.push(
      <Text key={idx} style={[
        { color: colors.textPrimary, lineHeight: isH3 ? 28 : 22, marginBottom: 4 },
        isH3 && { fontSize: 18, fontWeight: '700', marginTop: 8 },
        isSmall && { fontSize: 11 },
      ]}>
        {formatted}
      </Text>
    );
  });
  flushList('list_end');
  return elements;
};

const ContentViewerScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { type } = route.params;
  const meta = CONTENT_TYPES[type] || CONTENT_TYPES.terms;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const rolesRes = await apiClient.get(ENDPOINTS.ROLES);
      const roles = Array.isArray(rolesRes?.data) ? rolesRes.data : [];
      const patientRole = roles.find(r => r.name?.toLowerCase() === 'patient');
      const params = {};
      if (patientRole?.id) params.role_id = patientRole.id;
      const contentRes = await apiClient.get(`${ENDPOINTS.CONTENT_PAGES}/${type}`, { params });
      const item = contentRes?.data;
      setData(item ? [item] : []);
      setVersion(item?.version || null);
    } catch {
      setData([]);
      setVersion(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={meta.title}
        subtitle={meta.subtitle}
        subtitleRight={version ? `v${version}` : null}
        hideTitle
        onBack={() => navigation.goBack()}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={[colors.primary]} tintColor={colors.primary} />}>
          {data.length === 0 ? (
            <View style={styles.emptyBox}>
              <MCIcon name="file-document-outline" size={48} color={colors.border} />
              <Text style={styles.emptyText}>No data</Text>
            </View>
          ) : (
            data.map((item) => (
              <View key={item.id} style={styles.contentCard}>
                {item.content && (
                  <View style={styles.contentBody}>
                    {renderStyledContent(item.content, colors)}
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
  emptyBox: { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 15, color: colors.textMuted },

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
