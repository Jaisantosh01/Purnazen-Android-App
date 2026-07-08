import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

const AUDIENCES = [
  { key: 'all', label: 'Everyone', icon: 'account-group' },
  { key: 'users', label: 'Patients', icon: 'account' },
  { key: 'doctors', label: 'Doctors', icon: 'doctor' },
];

const CATEGORIES = [
  { key: 'promo', label: 'Promotional', hint: 'Respects each user’s offers opt-out' },
  { key: 'system', label: 'Important', hint: 'Delivered to everyone (ignores opt-outs)' },
];

const GLOBAL_SWITCHES = [
  { key: 'appointmentsEnabled', icon: 'calendar-clock', title: 'Appointment updates', sub: 'Bookings, confirmations, cancellations' },
  { key: 'paymentsEnabled', icon: 'credit-card-outline', title: 'Payment updates', sub: 'Receipts and payment failures' },
  { key: 'promosEnabled', icon: 'tag-outline', title: 'Promotions', sub: 'Offers and marketing broadcasts' },
  { key: 'remindersEnabled', icon: 'bell-ring-outline', title: 'Appointment reminders', sub: 'Scheduled before each appointment' },
];

const NotificationAdminScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [leadText, setLeadText] = useState('60');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [category, setCategory] = useState('promo');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.NOTIFICATION_SETTINGS)
      .then(res => {
        setSettings(res?.data || {});
        setLeadText(String(res?.data?.reminderLeadMinutes ?? 60));
      })
      .catch(() => Alert.alert('Error', 'Failed to load notification settings'));
  }, []);

  const saveSettings = updates => {
    setSaving(true);
    apiClient
      .put(ENDPOINTS.NOTIFICATION_SETTINGS, updates)
      .then(res => setSettings(res?.data || settings))
      .catch(() => Alert.alert('Error', 'Failed to save settings'))
      .finally(() => setSaving(false));
  };

  const toggle = key => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveSettings({ [key]: next[key] });
  };

  const saveLeadMinutes = () => {
    const minutes = parseInt(leadText, 10);
    if (Number.isNaN(minutes) || minutes < 5 || minutes > 1440) {
      Alert.alert('Invalid value', 'Reminder lead time must be 5–1440 minutes.');
      setLeadText(String(settings?.reminderLeadMinutes ?? 60));
      return;
    }
    saveSettings({ reminderLeadMinutes: minutes });
  };

  const sendBroadcast = () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing content', 'Please enter both a title and a message.');
      return;
    }
    const audienceLabel = AUDIENCES.find(a => a.key === audience)?.label || audience;
    Alert.alert(
      'Send broadcast?',
      `"${title.trim()}" will be sent to ${audienceLabel.toLowerCase()} as a ${category === 'promo' ? 'promotional' : 'important'} notification.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: () => {
            setSending(true);
            apiClient
              .post(ENDPOINTS.NOTIFICATION_BROADCAST, {
                title: title.trim(),
                body: body.trim(),
                audience,
                category,
              })
              .then(res => {
                Alert.alert('Sent', res?.message || 'Broadcast delivered');
                setTitle('');
                setBody('');
              })
              .catch(err =>
                Alert.alert('Error', err?.response?.data?.message || 'Broadcast failed')
              )
              .finally(() => setSending(false));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Notifications"
        subtitle="Broadcasts, global switches & reminders"
        onBack={() => navigation.goBack()}
      />

      {!settings ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* ── Broadcast composer ── */}
            <Text style={styles.sectionTitle}>Send a broadcast</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Title"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                maxLength={150}
              />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Message"
                placeholderTextColor={colors.textMuted}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={1000}
              />

              <Text style={styles.fieldLabel}>Audience</Text>
              <View style={styles.chipRow}>
                {AUDIENCES.map(a => (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.chip, audience === a.key && styles.chipActive]}
                    onPress={() => setAudience(a.key)}
                  >
                    <MCIcon name={a.icon} size={16} color={audience === a.key ? colors.white : colors.textSecondary} />
                    <Text style={[styles.chipText, audience === a.key && styles.chipTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.chip, category === c.key && styles.chipActive]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text style={[styles.chipText, category === c.key && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.hint}>{CATEGORIES.find(c => c.key === category)?.hint}</Text>

              <TouchableOpacity
                style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                onPress={sendBroadcast}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <MCIcon name="send" size={18} color={colors.white} />
                    <Text style={styles.sendBtnText}>Send broadcast</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ── Global switches ── */}
            <Text style={styles.sectionTitle}>Global switches</Text>
            <Text style={styles.sectionSub}>
              Turning a switch off stops that category for every user, overriding their personal settings.
            </Text>
            <View style={styles.card}>
              {GLOBAL_SWITCHES.map((row, i) => (
                <View key={row.key} style={[styles.switchRow, i > 0 && styles.switchRowBorder]}>
                  <View style={styles.switchIconWrap}>
                    <MCIcon name={row.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.switchTextCol}>
                    <Text style={styles.switchTitle}>{row.title}</Text>
                    <Text style={styles.switchSub}>{row.sub}</Text>
                  </View>
                  <Switch
                    value={!!settings[row.key]}
                    onValueChange={() => toggle(row.key)}
                    trackColor={{ false: colors.borderStrong, true: colors.primary }}
                    disabled={saving}
                  />
                </View>
              ))}
            </View>

            {/* ── Reminder schedule ── */}
            <Text style={styles.sectionTitle}>Reminder schedule</Text>
            <View style={styles.card}>
              <View style={styles.leadRow}>
                <View style={styles.switchTextCol}>
                  <Text style={styles.switchTitle}>Lead time (minutes)</Text>
                  <Text style={styles.switchSub}>How long before an appointment the reminder is sent</Text>
                </View>
                <TextInput
                  style={styles.leadInput}
                  value={leadText}
                  onChangeText={setLeadText}
                  onBlur={saveLeadMinutes}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 8, marginBottom: 8 },
  sectionSub: { fontSize: 12.5, color: colors.textMuted, marginBottom: 8, lineHeight: 18 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  inputMultiline: { height: 90, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.surfaceMuted,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  hint: { fontSize: 11.5, color: colors.textMuted, marginBottom: 12 },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13,
  },
  sendBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  switchRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  switchIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  switchTextCol: { flex: 1 },
  switchTitle: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  switchSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  leadInput: {
    width: 76, textAlign: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10, paddingVertical: 10,
    fontSize: 15, fontWeight: '700', color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
});

export default NotificationAdminScreen;
