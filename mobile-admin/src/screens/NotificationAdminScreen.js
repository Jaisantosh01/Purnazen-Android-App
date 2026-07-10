import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import { showAlert, showConfirm } from '../utils/alert';

const AUDIENCES = [
  { key: 'all', label: 'Everyone', icon: 'account-group' },
  { key: 'users', label: 'Patients', icon: 'account' },
  { key: 'doctors', label: 'Doctors', icon: 'doctor' },
];

// Personalized-offer targeting (resolved server-side).
const SEGMENTS = [
  { key: 'everyone', label: 'All', hint: 'No extra filtering' },
  { key: 'new_users', label: 'New users', hint: 'Joined in the last 30 days' },
  { key: 'inactive_users', label: 'Inactive', hint: 'No appointment in 60 days' },
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

const STATUS_CHIP = {
  sent:      { label: 'Sent',      color: '#10B981' },
  scheduled: { label: 'Scheduled', color: '#2563EB' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF' },
};

const pad2 = n => String(n).padStart(2, '0');
const toDateText = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toTimeText = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const formatWhen = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

// Quick schedule presets → a concrete future Date.
const PRESETS = [
  {
    key: 'hour', label: 'In 1 hour',
    make: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    key: 'tonight', label: 'Tonight 7 PM',
    make: () => {
      const d = new Date();
      d.setHours(19, 0, 0, 0);
      if (d <= new Date()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    key: 'tomorrow', label: 'Tomorrow 9 AM',
    make: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

const NotificationAdminScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scrollRef = useRef(null);

  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [leadText, setLeadText] = useState('60');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [segment, setSegment] = useState('everyone');
  const [category, setCategory] = useState('promo');
  const [sending, setSending] = useState(false);

  // Scheduling
  const [when, setWhen] = useState('now'); // now | schedule
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');

  // Recent broadcasts
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);

  const fetchBroadcasts = useCallback(() => {
    apiClient
      .get(ENDPOINTS.NOTIFICATION_BROADCASTS)
      .then(res => setBroadcasts(res?.data?.broadcasts || []))
      .catch(() => {})
      .finally(() => setLoadingBroadcasts(false));
  }, []);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.NOTIFICATION_SETTINGS)
      .then(res => {
        setSettings(res?.data || {});
        setLeadText(String(res?.data?.reminderLeadMinutes ?? 60));
      })
      .catch(() => showAlert('Error', 'Failed to load notification settings'));
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  const saveSettings = updates => {
    setSaving(true);
    apiClient
      .put(ENDPOINTS.NOTIFICATION_SETTINGS, updates)
      .then(res => setSettings(res?.data || settings))
      .catch(() => showAlert('Error', 'Failed to save settings'))
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
      showAlert('Invalid value', 'Reminder lead time must be 5–1440 minutes.');
      setLeadText(String(settings?.reminderLeadMinutes ?? 60));
      return;
    }
    saveSettings({ reminderLeadMinutes: minutes });
  };

  const applyPreset = preset => {
    const d = preset.make();
    setDateText(toDateText(d));
    setTimeText(toTimeText(d));
  };

  // Returns a local "YYYY-MM-DDTHH:MM:00" string, or null (send now),
  // or throws a user-facing message when the custom input is invalid.
  const resolveScheduledAt = () => {
    if (when === 'now') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText.trim()) || !/^\d{1,2}:\d{2}$/.test(timeText.trim())) {
      throw new Error('Enter the schedule as date YYYY-MM-DD and time HH:MM (24h), or pick a preset.');
    }
    const [h, m] = timeText.trim().split(':').map(Number);
    const target = new Date(`${dateText.trim()}T00:00:00`);
    target.setHours(h, m, 0, 0);
    if (Number.isNaN(target.getTime()) || h > 23 || m > 59) {
      throw new Error('That date/time is not valid.');
    }
    if (target <= new Date()) {
      throw new Error('The scheduled time must be in the future.');
    }
    return `${toDateText(target)}T${toTimeText(target)}:00`;
  };

  const resetComposer = () => {
    setTitle('');
    setBody('');
    setWhen('now');
    setDateText('');
    setTimeText('');
  };

  const sendBroadcast = () => {
    if (!title.trim() || !body.trim()) {
      showAlert('Missing content', 'Please enter both a title and a message.');
      return;
    }
    let scheduledAt = null;
    try {
      scheduledAt = resolveScheduledAt();
    } catch (e) {
      showAlert('Invalid schedule', e.message);
      return;
    }

    const audienceLabel = (AUDIENCES.find(a => a.key === audience)?.label || audience).toLowerCase();
    const segmentLabel = segment !== 'everyone'
      ? ` (${SEGMENTS.find(s => s.key === segment)?.label.toLowerCase()})`
      : '';
    const whenLabel = scheduledAt
      ? `scheduled for ${formatWhen(scheduledAt)}`
      : 'sent immediately';

    showAlert(
      scheduledAt ? 'Schedule broadcast?' : 'Send broadcast?',
      `"${title.trim()}" will be ${whenLabel} to ${audienceLabel}${segmentLabel} as a ${category === 'promo' ? 'promotional' : 'important'} notification.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: scheduledAt ? 'Schedule' : 'Send',
          onPress: () => {
            setSending(true);
            apiClient
              .post(ENDPOINTS.NOTIFICATION_BROADCAST, {
                title: title.trim(),
                body: body.trim(),
                audience,
                segment,
                category,
                ...(scheduledAt ? { scheduledAt } : {}),
              })
              .then(res => {
                showAlert(scheduledAt ? 'Scheduled' : 'Sent', res?.message || 'Broadcast delivered');
                resetComposer();
                fetchBroadcasts();
              })
              .catch(err =>
                showAlert('Error', err?.response?.data?.message || 'Broadcast failed')
              )
              .finally(() => setSending(false));
          },
        },
      ],
    );
  };

  // Prefill the composer from a past broadcast so it can be tweaked & resent.
  const duplicateBroadcast = b => {
    setTitle(b.title || '');
    setBody(b.body || '');
    setAudience(b.audience || 'all');
    setSegment(b.segment || 'everyone');
    setCategory(b.category || 'promo');
    setWhen('now');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const cancelScheduled = b => {
    showConfirm(
      'Cancel scheduled broadcast?',
      `"${b.title}" will not be sent.`,
      () => {
        apiClient
          .delete(ENDPOINTS.NOTIFICATION_BROADCAST_CANCEL(b.id))
          .then(() => fetchBroadcasts())
          .catch(err =>
            showAlert('Error', err?.response?.data?.message || 'Could not cancel broadcast')
          );
      },
      { confirmLabel: 'Cancel broadcast', destructive: true },
    );
  };

  const renderBroadcast = (b, index) => {
    const chip = STATUS_CHIP[b.status] || STATUS_CHIP.sent;
    const audienceLabel = AUDIENCES.find(a => a.key === b.audience)?.label || b.audience;
    const segmentLabel = SEGMENTS.find(s => s.key === b.segment)?.label;
    const metaParts = [
      audienceLabel,
      b.segment && b.segment !== 'everyone' ? segmentLabel : null,
      b.category === 'promo' ? 'Promo' : 'Important',
      b.status === 'sent' ? `${b.recipients} recipient${b.recipients === 1 ? '' : 's'}` : null,
      b.status === 'scheduled' ? `for ${formatWhen(b.scheduledAt)}` : null,
    ].filter(Boolean);

    return (
      <View key={b.id} style={[styles.broadcastRow, index > 0 && styles.broadcastRowBorder]}>
        <View style={styles.broadcastHeader}>
          <Text style={styles.broadcastTitle} numberOfLines={1}>{b.title}</Text>
          <View style={[styles.statusChip, { backgroundColor: chip.color + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: chip.color }]} />
            <Text style={[styles.statusChipText, { color: chip.color }]}>{chip.label}</Text>
          </View>
        </View>
        <Text style={styles.broadcastBody} numberOfLines={2}>{b.body}</Text>
        <Text style={styles.broadcastMeta}>
          {metaParts.join('  ·  ')}
        </Text>
        <View style={styles.broadcastActions}>
          <Text style={styles.broadcastTime}>{formatWhen(b.sentAt || b.createdAt)}</Text>
          <View style={styles.broadcastBtnRow}>
            {b.status === 'scheduled' && (
              <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDanger]} onPress={() => cancelScheduled(b)}>
                <MCIcon name="close-circle-outline" size={14} color={colors.danger} />
                <Text style={styles.smallBtnDangerText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.smallBtn} onPress={() => duplicateBroadcast(b)}>
              <MCIcon name="content-copy" size={14} color={colors.primary} />
              <Text style={styles.smallBtnText}>Duplicate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >

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
              <Text style={styles.hint}>
                Tip: write {'{name}'} anywhere — each recipient sees their own first name.
              </Text>

              <Text style={styles.fieldLabel}>Audience</Text>
              <View style={styles.chipRow}>
                {AUDIENCES.map(a => (
                  <TouchableOpacity
                    key={a.key}
                    style={[styles.chip, audience === a.key && styles.chipActive]}
                    onPress={() => {
                      setAudience(a.key);
                      if (a.key === 'doctors') setSegment('everyone');
                    }}
                  >
                    <MCIcon name={a.icon} size={16} color={audience === a.key ? colors.white : colors.textSecondary} />
                    <Text style={[styles.chipText, audience === a.key && styles.chipTextActive]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {audience !== 'doctors' && (
                <>
                  <Text style={styles.fieldLabel}>Target segment</Text>
                  <View style={styles.chipRow}>
                    {SEGMENTS.map(s => (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.chip, segment === s.key && styles.chipActive]}
                        onPress={() => setSegment(s.key)}
                      >
                        <Text style={[styles.chipText, segment === s.key && styles.chipTextActive]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.hint}>{SEGMENTS.find(s => s.key === segment)?.hint}</Text>
                </>
              )}

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

              <Text style={styles.fieldLabel}>Delivery</Text>
              <View style={styles.chipRow}>
                {[
                  { key: 'now', label: 'Send now', icon: 'send' },
                  { key: 'schedule', label: 'Schedule', icon: 'clock-outline' },
                ].map(w => (
                  <TouchableOpacity
                    key={w.key}
                    style={[styles.chip, when === w.key && styles.chipActive]}
                    onPress={() => setWhen(w.key)}
                  >
                    <MCIcon name={w.icon} size={15} color={when === w.key ? colors.white : colors.textSecondary} />
                    <Text style={[styles.chipText, when === w.key && styles.chipTextActive]}>{w.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {when === 'schedule' && (
                <>
                  <View style={styles.chipRow}>
                    {PRESETS.map(p => (
                      <TouchableOpacity key={p.key} style={styles.presetChip} onPress={() => applyPreset(p)}>
                        <Text style={styles.presetChipText}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.scheduleRow}>
                    <TextInput
                      style={[styles.input, styles.scheduleInput]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textMuted}
                      value={dateText}
                      onChangeText={setDateText}
                      maxLength={10}
                    />
                    <TextInput
                      style={[styles.input, styles.scheduleInput]}
                      placeholder="HH:MM"
                      placeholderTextColor={colors.textMuted}
                      value={timeText}
                      onChangeText={setTimeText}
                      maxLength={5}
                    />
                  </View>
                  <Text style={styles.hint}>24-hour time. The broadcast is dispatched within a minute of the chosen time.</Text>
                </>
              )}

              <TouchableOpacity
                style={[styles.sendBtn, sending && { opacity: 0.6 }]}
                onPress={sendBroadcast}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <>
                    <MCIcon name={when === 'schedule' ? 'clock-outline' : 'send'} size={18} color={colors.white} />
                    <Text style={styles.sendBtnText}>
                      {when === 'schedule' ? 'Schedule broadcast' : 'Send broadcast'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* ── Recent broadcasts ── */}
            <Text style={styles.sectionTitle}>Recent broadcasts</Text>
            <Text style={styles.sectionSub}>
              Duplicate one to edit &amp; resend it, or cancel a scheduled send.
            </Text>
            <View style={styles.card}>
              {loadingBroadcasts ? (
                <ActivityIndicator color={colors.primary} style={{ paddingVertical: 18 }} />
              ) : broadcasts.length === 0 ? (
                <View style={styles.emptyBroadcasts}>
                  <MCIcon name="bullhorn-outline" size={34} color={colors.textMuted} />
                  <Text style={styles.emptyBroadcastsText}>No broadcasts yet</Text>
                </View>
              ) : (
                broadcasts.slice(0, 10).map(renderBroadcast)
              )}
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
  presetChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
  },
  presetChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  scheduleRow: { flexDirection: 'row', gap: 10 },
  scheduleInput: { flex: 1, textAlign: 'center' },
  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13,
  },
  sendBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  // Recent broadcasts
  broadcastRow: { paddingVertical: 12 },
  broadcastRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  broadcastHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  broadcastTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 11, fontWeight: '800' },
  broadcastBody: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, lineHeight: 17 },
  broadcastMeta: { fontSize: 11.5, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  broadcastActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8,
  },
  broadcastTime: { fontSize: 11, color: colors.textMuted },
  broadcastBtnRow: { flexDirection: 'row', gap: 8 },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14, backgroundColor: colors.primaryLight,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  smallBtnDanger: { backgroundColor: colors.danger + '1A' },
  smallBtnDangerText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  emptyBroadcasts: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyBroadcastsText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

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
