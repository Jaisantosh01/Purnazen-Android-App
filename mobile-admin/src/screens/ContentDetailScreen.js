import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

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
      const formatted = parseInlineTags(text, colors);
      listBuffer.push(formatted);
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
        { lineHeight: isH3 ? 28 : 22, marginBottom: 4 },
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

const parseInlineTags = (text, colors) => {
  const parts = [];
  let remaining = text;

  const extractTag = (tag, style) => {
    const open = `<${tag}>`;
    const close = `</${tag}>`;
    const result = [];
    let rest = remaining;

    while (rest.includes(open)) {
      const beforeIdx = rest.indexOf(open);
      const before = rest.substring(0, beforeIdx);
      if (before) result.push(<Text key={`${tag}_${result.length}`} style={style}>{before}</Text>);
      const afterOpen = rest.substring(beforeIdx + open.length);
      const closeIdx = afterOpen.indexOf(close);
      if (closeIdx === -1) { result.push(<Text key={`${tag}_${result.length}`} style={style}>{afterOpen}</Text>); rest = ''; break; }
      const inner = afterOpen.substring(0, closeIdx);
      result.push(<Text key={`${tag}_${result.length}`} style={style}>{inner}</Text>);
      rest = afterOpen.substring(closeIdx + close.length);
    }

    if (rest) result.push(<Text key={`${tag}_end`} style={{}}>{rest}</Text>);
    remaining = '';
    return result;
  };

  const boldParts = [];
  let boldRest = remaining;
  while (boldRest.includes('<b>')) {
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

const ContentDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { item } = route.params;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={item.title || item.type}
        subtitle={`v${item.version || '1.0'} \u2022 ${item.roleType === 'all' ? 'All Roles' : item.roleType}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: item.type === 'terms' ? colors.primaryLight : colors.primaryFaint }]}>
            <MCIcon name={item.type === 'terms' ? 'file-document-outline' : 'shield-lock-outline'} size={14} color={colors.textSecondary} />
            <Text style={styles.badgeText}>{item.type === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}</Text>
          </View>
          <View style={styles.statusDot}>
            <View style={[styles.dot, { backgroundColor: item.isActive ? '#22C55E' : colors.textMuted }]} />
            <Text style={styles.statusText}>{item.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {renderStyledContent(item.content, colors)}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Created: {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
          </Text>
          <Text style={styles.footerText}>
            Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  statusDot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  footer: { marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 },
  footerText: { fontSize: 11, color: colors.textMuted },
});

export default ContentDetailScreen;
