import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { showAlert } from '../utils/alert';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppVersionFooter from '../components/AppVersionFooter';
import supportService from '../services/supportService';

// App-meta links (Terms/Privacy/Rate/Share). These aren't content — they stay
// in the app and show a "coming soon" notice until they're wired up.
const QUICK_LINKS = [
  { icon: 'file-document-outline', title: 'Terms & Conditions', color: '#6B7280', screen: 'ContentViewer', params: { type: 'terms' } },
  { icon: 'shield-check-outline',  title: 'Privacy Policy',     color: '#6B7280', screen: 'ContentViewer', params: { type: 'privacy' } },
  { icon: 'star-outline',          title: 'Rate the App',       color: '#F59E0B' },
  { icon: 'share-variant-outline', title: 'Share with Friends', color: '#1FA77A' },
];

const HelpSupportScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const comingSoon = label =>
    showAlert('Coming soon', `${label} will be available in an upcoming update.`);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await supportService.getHelp();
      setContacts(data.contacts);
      setFaqs(data.faqs);
    } catch (err) {
      setError(err.message || 'Failed to load help content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build the tap action from the contact's type + value (admin-configured).
  const handleContact = c => {
    const v = c.value;
    const open = url => Linking.openURL(url).catch(() => comingSoon(c.title));
    switch (c.type) {
      case 'email':    return v ? open(`mailto:${v}`) : comingSoon(c.title);
      case 'phone':    return v ? open(`tel:${v}`) : comingSoon(c.title);
      case 'whatsapp': return v ? open(`whatsapp://send?phone=${v}`) : comingSoon(c.title);
      case 'chat':     return comingSoon('Live chat');
      default:         return v ? open(v) : comingSoon(c.title);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Help & Support" subtitle="We're here to help you" backBehavior="popToRoot" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.emptyBox}>
            <MCIcon name="wifi-off" size={44} color={colors.border} />
            <Text style={styles.emptyTitle}>Couldn't load help content</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load()} activeOpacity={0.85}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Contact Us — only render when the admin has configured channels */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Us</Text>
              {contacts.length === 0 ? (
                <View style={styles.inlineEmpty}>
                  <MCIcon name="headset" size={28} color={colors.border} />
                  <Text style={styles.inlineEmptyTitle}>Coming soon</Text>
                  <Text style={styles.emptyText}>Support channels will be available shortly.</Text>
                </View>
              ) : (
                <View style={styles.contactGrid}>
                  {contacts.map(opt => {
                    const tint = opt.color || colors.primary;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.contactCard, { backgroundColor: tint + '14' }]}
                        activeOpacity={0.8}
                        onPress={() => handleContact(opt)}
                      >
                        <View style={[styles.contactIconCircle, { backgroundColor: tint + '22' }]}>
                          <MCIcon name={opt.icon || 'help-circle-outline'} size={24} color={tint} />
                        </View>
                        <Text style={[styles.contactTitle, { color: tint }]}>{opt.title}</Text>
                        {opt.subtitle ? <Text style={styles.contactSub}>{opt.subtitle}</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* FAQs */}
            {faqs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                {faqs.map(faq => (
                  <TouchableOpacity
                    key={faq.id}
                    style={styles.faqCard}
                    activeOpacity={0.8}
                    onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  >
                    <View style={styles.faqHeader}>
                      <Text style={styles.faqQuestion}>{faq.question}</Text>
                      <MCIcon
                        name={expandedFaq === faq.id ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.textMuted}
                      />
                    </View>
                    {expandedFaq === faq.id && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* More */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>More</Text>
              <View style={styles.quickLinksCard}>
                {QUICK_LINKS.map((link, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.quickLinkRow, index < QUICK_LINKS.length - 1 && styles.quickLinkBorder]}
                    activeOpacity={0.7}
                    onPress={() => link.screen ? navigation.navigate(link.screen, link.params) : comingSoon(link.title)}
                  >
                    <View style={styles.quickLinkLeft}>
                      <MCIcon name={link.icon} size={20} color={link.color} />
                      <Text style={styles.quickLinkText}>{link.title}</Text>
                    </View>
                    <MCIcon name="chevron-right" size={20} color={colors.borderStrong} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <AppVersionFooter />
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default HelpSupportScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 40, flexGrow: 1 },

  loaderBox: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },

  emptyBox: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  inlineEmpty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 28,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  inlineEmptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 16 },
  retryBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 12,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: colors.white },

  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },

  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactCard: { width: '47%', borderRadius: 16, padding: 16, alignItems: 'flex-start' },
  contactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  contactTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  contactSub: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  faqCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQuestion: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1, paddingRight: 8 },
  faqAnswer: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },

  quickLinksCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  quickLinkBorder: { borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  quickLinkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickLinkText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

});
