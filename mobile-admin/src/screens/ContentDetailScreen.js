import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { renderRichText } from '../utils/richText';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const ContentDetailScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { item } = route.params;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={item.title || item.type}
        subtitle={`v${item.version || '1.0'} • ${item.roleType === 'all' ? 'All Roles' : item.roleType}`}
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

        {renderRichText(item.content, colors)}

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
