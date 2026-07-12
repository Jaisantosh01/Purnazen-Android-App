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

const HELP_LINKS = [
  { icon: 'frequently-asked-questions', iconColor: '#7C3AED', title: 'FAQ', subtitle: 'Frequently asked questions', screen: 'ContentViewer', params: { type: 'faq' } },
  { icon: 'file-document-outline',      iconColor: '#F59E0B', title: 'Terms & Conditions', subtitle: 'Terms of service',    screen: 'ContentViewer', params: { type: 'terms' } },
  { icon: 'shield-lock-outline',        iconColor: '#10B981', title: 'Privacy Policy',     subtitle: 'Data privacy notice', screen: 'ContentViewer', params: { type: 'privacy' } },
];

const HelpSupportScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Help & Support" subtitle="Get assistance" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          {HELP_LINKS.map((link, index) => (
            <TouchableOpacity
              key={index}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(link.screen, link.params)}
            >
              <View style={[styles.iconCircle, { backgroundColor: link.iconColor + '22' }]}>
                <MCIcon name={link.icon} size={22} color={link.iconColor} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{link.title}</Text>
                <Text style={styles.cardSubtitle}>{link.subtitle}</Text>
              </View>
              <MCIcon name="chevron-right" size={20} color={colors.borderStrong} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 32 },

  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

export default HelpSupportScreen;
