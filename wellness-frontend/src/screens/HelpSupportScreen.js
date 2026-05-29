import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const FAQS = [
  {
    id: '1',
    question: 'How do I book a consultation?',
    answer: 'Go to the Consult tab, browse available doctors, tap on a doctor to view their profile, then tap "Book Appointment" to select a date, time, and visit type.',
  },
  {
    id: '2',
    question: 'How do I cancel or reschedule an appointment?',
    answer: 'Go to Profile → Therapy History, find the appointment, and tap "Cancel" or "Reschedule." Cancellations made 24 hours before the appointment are fully refunded.',
  },
  {
    id: '3',
    question: 'What payment methods are accepted?',
    answer: 'We accept Credit/Debit Cards, UPI (Google Pay, PhonePe, Paytm), and major digital wallets. All transactions are secured with 256-bit encryption.',
  },
  {
    id: '4',
    question: 'Are the wellness sessions free?',
    answer: 'Yes! Yoga, Meditation, Breathing Exercises, and all wellness programs are free for all users. Premium members get access to exclusive programs and personalized plans.',
  },
  {
    id: '5',
    question: 'How do I upgrade to Premium?',
    answer: 'Go to Profile → Subscriptions to view available plans. Premium includes unlimited consultations, exclusive wellness programs, and priority support.',
  },
  {
    id: '6',
    question: 'Is my health data secure?',
    answer: 'Absolutely. All your health data is encrypted and stored securely. We follow HIPAA guidelines and never share your personal data with third parties without your consent.',
  },
];

const CONTACT_OPTIONS = [
  {
    id: '1',
    icon: 'chat-outline',
    title: 'Live Chat',
    subtitle: 'Typically replies in 2 minutes',
    color: '#1FA77A',
    bg: '#e8f8f2',
    action: () => Alert.alert('Live Chat', 'Connecting you to a support agent...'),
  },
  {
    id: '2',
    icon: 'email-outline',
    title: 'Email Support',
    subtitle: 'support@mheal.com',
    color: '#4f46e5',
    bg: '#EEF2FF',
    action: () => Linking.openURL('mailto:support@mheal.com'),
  },
  {
    id: '3',
    icon: 'phone-outline',
    title: 'Call Us',
    subtitle: '+91 1800-123-4567 (Toll Free)',
    color: '#0284c7',
    bg: '#E0F2FE',
    action: () => Linking.openURL('tel:+911800123456'),
  },
  {
    id: '4',
    icon: 'whatsapp',
    title: 'WhatsApp',
    subtitle: '+91 98765 43210',
    color: '#25D366',
    bg: '#EDFDF4',
    action: () => Linking.openURL('whatsapp://send?phone=919876543210'),
  },
];

const QUICK_LINKS = [
  { icon: 'file-document-outline', title: 'Terms & Conditions',  color: '#6b7280' },
  { icon: 'shield-check-outline',  title: 'Privacy Policy',      color: '#6b7280' },
  { icon: 'star-outline',          title: 'Rate the App',        color: '#f59e0b' },
  { icon: 'share-variant-outline', title: 'Share with Friends',  color: '#1FA77A' },
];

const HelpSupportScreen = ({ navigation }) => {
  const [expandedFaq, setExpandedFaq] = useState(null);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1FA77A" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MCIcon name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSubtitle}>We're here to help you</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.contactGrid}>
            {CONTACT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.contactCard, { backgroundColor: opt.bg }]}
                activeOpacity={0.8}
                onPress={opt.action}
              >
                <View style={[styles.contactIconCircle, { backgroundColor: opt.color + '22' }]}>
                  <MCIcon name={opt.icon} size={24} color={opt.color} />
                </View>
                <Text style={[styles.contactTitle, { color: opt.color }]}>{opt.title}</Text>
                <Text style={styles.contactSub}>{opt.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {FAQS.map(faq => (
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
                  color="#9ca3af"
                />
              </View>
              {expandedFaq === faq.id && (
                <Text style={styles.faqAnswer}>{faq.answer}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More</Text>
          <View style={styles.quickLinksCard}>
            {QUICK_LINKS.map((link, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.quickLinkRow, index < QUICK_LINKS.length - 1 && styles.quickLinkBorder]}
                activeOpacity={0.7}
              >
                <View style={styles.quickLinkLeft}>
                  <MCIcon name={link.icon} size={20} color={link.color} />
                  <Text style={styles.quickLinkText}>{link.title}</Text>
                </View>
                <MCIcon name="chevron-right" size={20} color="#d1d5db" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Version */}
        <View style={styles.versionRow}>
          <MCIcon name="information-outline" size={14} color="#9ca3af" />
          <Text style={styles.versionText}>  M-Heal v1.0.0 · Made with ❤️ for your wellness</Text>
        </View>

      </ScrollView>
    </View>
  );
};

export default HelpSupportScreen;

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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },

  // Contact grid
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactCard: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  contactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  contactSub: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 16,
  },

  // FAQ
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    paddingRight: 8,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },

  // Quick links
  quickLinksCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
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
  quickLinkBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  quickLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },

  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
