import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import apiClient from '../api/client';
import { ENDPOINTS } from '../constants/apiEndpoints';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppToggle from '../components/AppToggle';
import { showAlert, showConfirm } from '../utils/alert';

import {
  AUDIENCES,
  SEGMENTS,
  CATEGORIES,
  GLOBAL_SWITCHES,
  STATUS_CHIP,
  PRESETS,
  REMINDER_PRESETS,
  HISTORY_FILTERS,
  PREVIEW_APP_NAME,
  personalize,
  toDateText,
  toTimeText,
  formatWhen,
} from '../constants/notifications';

/**
 * Notification admin, split into three tabs.
 *
 * Everything used to live on one scroll — composer, history, global switches
 * and the reminder setting — so sending a message meant scrolling past config
 * an admin touches once a quarter. Composing is now its own tab, and inside it
 * the audience/type/delivery config collapses behind one-line summaries, which
 * keeps the message itself and its live preview at the top where they belong.
 */
const TABS = [
  { key: 'compose', label: 'Compose', icon: 'bullhorn-outline' },
  { key: 'history', label: 'History', icon: 'history' },
  { key: 'settings', label: 'Settings', icon: 'tune-variant' },
];

const TAB_SUBTITLE = {
  compose: 'Write and send a broadcast',
  history: 'Sent, scheduled and cancelled',
  settings: 'Global switches and reminders',
};

const TITLE_MAX = 150;
const BODY_MAX = 1000;

/** One collapsible block of composer config, closed down to a summary line. */
const Section = ({ icon, title, summary, warn, open, onToggle, children, styles, colors }) => (
  <View style={[styles.section, open && styles.sectionOpen]}>
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.sectionIcon}>
        <MCIcon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.sectionHeadText}>
        <Text style={styles.sectionName}>{title}</Text>
        <Text
          style={[styles.sectionSummary, warn && styles.sectionSummaryWarn]}
          numberOfLines={1}
        >
          {summary}
        </Text>
      </View>
      <MCIcon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
    </TouchableOpacity>
    {open ? <View style={styles.sectionBody}>{children}</View> : null}
  </View>
);

const NotificationAdminScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const composeRef = useRef(null);

  const [tab, setTab] = useState('compose');

  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [leadText, setLeadText] = useState('60');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [segment, setSegment] = useState('everyone');
  const [category, setCategory] = useState('promo');
  const [sending, setSending] = useState(false);
  // One config block open at a time — with all three expanded the send button
  // ends up two screens below the message it belongs to.
  const [openSection, setOpenSection] = useState(null);

  // Scheduling
  const [when, setWhen] = useState('now'); // now | schedule
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');

  // Recent broadcasts
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');

  const fetchBroadcasts = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    apiClient
      .get(ENDPOINTS.NOTIFICATION_BROADCASTS)
      .then(res => setBroadcasts(res?.data?.broadcasts || []))
      .catch(() => {})
      .finally(() => { setLoadingBroadcasts(false); setRefreshing(false); });
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

  const applyLeadMinutes = minutes => {
    if (Number.isNaN(minutes) || minutes < 5 || minutes > 1440) {
      showAlert('Invalid value', 'Reminder lead time must be 5–1440 minutes.');
      setLeadText(String(settings?.reminderLeadMinutes ?? 60));
      return;
    }
    setLeadText(String(minutes));
    // Blur fires whether or not the number changed — don't PUT a no-op.
    if (minutes === settings?.reminderLeadMinutes) return;
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
    setOpenSection(null);
  };

  const audienceLabel = AUDIENCES.find(a => a.key === audience)?.label || audience;
  const segmentLabel = SEGMENTS.find(s => s.key === segment)?.label || segment;
  const categoryLabel = CATEGORIES.find(c => c.key === category)?.label || category;
  const audienceSummary =
    audience === 'doctors' || segment === 'everyone'
      ? audienceLabel
      : `${audienceLabel} · ${segmentLabel}`;
  const deliverySummary =
    when === 'now'
      ? 'Send now'
      : dateText && timeText
        ? `${dateText} at ${timeText}`
        : 'Schedule — pick a date and time';

  // A promo broadcast is dropped for every recipient when the global promos
  // switch is off (notify() gates on it before opt-outs), so the send would
  // report "0 recipients" with nothing on screen explaining why.
  const promoBlocked = category === 'promo' && settings?.promosEnabled === false;
  const canSend = !!title.trim() && !!body.trim();

  const sendBroadcast = () => {
    if (!canSend) {
      showAlert('Missing content', 'Please enter both a title and a message.');
      return;
    }
    let scheduledAt = null;
    try {
      scheduledAt = resolveScheduledAt();
    } catch (e) {
      setOpenSection('delivery');
      showAlert('Invalid schedule', e.message);
      return;
    }

    const segmentSuffix = audience !== 'doctors' && segment !== 'everyone'
      ? ` (${segmentLabel.toLowerCase()})`
      : '';
    const whenLabel = scheduledAt
      ? `scheduled for ${formatWhen(scheduledAt)}`
      : 'sent immediately';

    const confirmSend = () => {
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
          setTab('history');
        })
        .catch(err =>
          showAlert('Error', err?.response?.data?.message || 'Broadcast failed')
        )
        .finally(() => setSending(false));
    };

    showAlert(
      scheduledAt ? 'Schedule broadcast?' : 'Send broadcast?',
      `"${title.trim()}" will be ${whenLabel} to ${audienceLabel.toLowerCase()}${segmentSuffix} as a ${categoryLabel.toLowerCase()} notification.` +
        (promoBlocked
          ? '\n\nPromotions are switched off globally, so nobody will receive this.'
          : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: scheduledAt ? 'Schedule' : 'Send', onPress: confirmSend },
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
    setDateText('');
    setTimeText('');
    setOpenSection(null);
    setTab('compose');
    composeRef.current?.scrollTo({ y: 0, animated: false });
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

  const scheduledCount = broadcasts.filter(b => b.status === 'scheduled').length;
  const visibleBroadcasts = historyFilter === 'all'
    ? broadcasts
    : broadcasts.filter(b => b.status === historyFilter);

  const renderBroadcast = (b, index) => {
    const chip = STATUS_CHIP[b.status] || STATUS_CHIP.sent;
    const rowAudience = AUDIENCES.find(a => a.key === b.audience)?.label || b.audience;
    const rowSegment = SEGMENTS.find(s => s.key === b.segment)?.label;
    const metaParts = [
      rowAudience,
      b.segment && b.segment !== 'everyone' ? rowSegment : null,
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

  const renderCompose = () => (
    <ScrollView
      ref={composeRef}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {/* Live preview — what the recipient's lock screen shows, token expanded */}
      <Text style={styles.eyebrow}>Preview</Text>
      <View style={styles.previewCard}>
        <View style={styles.previewHead}>
          <View style={styles.previewAppIcon}>
            <MCIcon name="spa-outline" size={14} color={colors.white} />
          </View>
          <Text style={styles.previewApp}>{PREVIEW_APP_NAME}</Text>
          <Text style={styles.previewTime}>
            {when === 'schedule' && dateText && timeText ? `${dateText} ${timeText}` : 'now'}
          </Text>
        </View>
        <Text style={[styles.previewTitle, !title.trim() && styles.previewGhost]} numberOfLines={2}>
          {title.trim() ? personalize(title) : 'Notification title'}
        </Text>
        <Text style={[styles.previewBody, !body.trim() && styles.previewGhost]} numberOfLines={4}>
          {body.trim() ? personalize(body) : 'Your message appears here.'}
        </Text>
      </View>
      <Text style={styles.previewNote}>
        Sample name shown for {'{name}'}. Each recipient sees their own.
      </Text>

      {/* Message */}
      <View style={styles.card}>
        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>Title</Text>
          <Text style={styles.counter}>{title.length}/{TITLE_MAX}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Short and specific"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={TITLE_MAX}
        />

        <View style={styles.labelRow}>
          <Text style={styles.fieldLabel}>Message</Text>
          <Text style={styles.counter}>{body.length}/{BODY_MAX}</Text>
        </View>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="What do you want them to know?"
          placeholderTextColor={colors.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={BODY_MAX}
        />

        <TouchableOpacity
          style={styles.tokenBtn}
          onPress={() => setBody(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{name}`)}
        >
          <MCIcon name="account-outline" size={14} color={colors.primary} />
          <Text style={styles.tokenBtnText}>Insert {'{name}'}</Text>
        </TouchableOpacity>
      </View>

      {/* Audience → Delivery, collapsed to summaries */}
      <Section
        icon="account-group-outline"
        title="Audience"
        summary={audienceSummary}
        open={openSection === 'audience'}
        onToggle={() => setOpenSection(prev => (prev === 'audience' ? null : 'audience'))}
        styles={styles}
        colors={colors}
      >
        <Text style={styles.fieldLabel}>Send to</Text>
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

        {audience !== 'doctors' ? (
          <>
            <Text style={styles.fieldLabel}>Narrow it down</Text>
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
        ) : (
          <Text style={styles.hint}>Segments apply to patients only.</Text>
        )}
      </Section>

      <Section
        icon="label-outline"
        title="Type"
        summary={promoBlocked ? `${categoryLabel} — currently switched off` : categoryLabel}
        warn={promoBlocked}
        open={openSection === 'type'}
        onToggle={() => setOpenSection(prev => (prev === 'type' ? null : 'type'))}
        styles={styles}
        colors={colors}
      >
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
      </Section>

      <Section
        icon="clock-outline"
        title="Delivery"
        summary={deliverySummary}
        open={openSection === 'delivery'}
        onToggle={() => setOpenSection(prev => (prev === 'delivery' ? null : 'delivery'))}
        styles={styles}
        colors={colors}
      >
        <View style={styles.chipRow}>
          {[
            { key: 'now', label: 'Send now', icon: 'send' },
            { key: 'schedule', label: 'Schedule', icon: 'calendar-clock' },
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

        {when === 'schedule' ? (
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
        ) : null}
      </Section>

      {promoBlocked ? (
        <View style={styles.warnBanner}>
          <MCIcon name="alert-outline" size={18} color={colors.danger} />
          <View style={styles.warnTextCol}>
            <Text style={styles.warnText}>
              Promotions are off globally, so this broadcast reaches nobody.
            </Text>
            <TouchableOpacity onPress={() => setTab('settings')}>
              <Text style={styles.warnLink}>Open Settings to turn them on</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.sendBtn, (sending || !canSend) && styles.sendBtnDisabled]}
        onPress={sendBroadcast}
        disabled={sending || !canSend}
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
      {!canSend ? (
        <Text style={styles.sendHint}>A title and a message are required.</Text>
      ) : null}
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchBroadcasts(true)}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.chipRow}>
        {HISTORY_FILTERS.map(f => {
          const count = f.key === 'all'
            ? broadcasts.length
            : broadcasts.filter(b => b.status === f.key).length;
          const active = historyFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setHistoryFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.card}>
        {loadingBroadcasts ? (
          <ActivityIndicator color={colors.primary} style={styles.listSpinner} />
        ) : visibleBroadcasts.length === 0 ? (
          <View style={styles.emptyBroadcasts}>
            <MCIcon name="bullhorn-outline" size={34} color={colors.textMuted} />
            <Text style={styles.emptyBroadcastsText}>
              {broadcasts.length === 0 ? 'No broadcasts yet' : `No ${historyFilter} broadcasts`}
            </Text>
            {broadcasts.length === 0 ? (
              <TouchableOpacity onPress={() => setTab('compose')}>
                <Text style={styles.emptyLink}>Compose the first one</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          visibleBroadcasts.map(renderBroadcast)
        )}
      </View>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>Global switches</Text>
      <Text style={styles.sectionSub}>
        Turning a switch off stops that category for every user, overriding their personal settings.
      </Text>
      <View style={styles.card}>
        {GLOBAL_SWITCHES.map((row, i) => {
          const on = !!settings[row.key];
          return (
            <View key={row.key} style={[styles.switchRow, i > 0 && styles.switchRowBorder]}>
              <View style={[styles.switchIconWrap, !on && styles.switchIconWrapOff]}>
                <MCIcon name={row.icon} size={20} color={on ? colors.primary : colors.textMuted} />
              </View>
              <View style={styles.switchTextCol}>
                <Text style={styles.switchTitle}>{row.title}</Text>
                <Text style={styles.switchSub}>{on ? row.sub : 'Off — nobody receives these'}</Text>
              </View>
              <AppToggle
                value={on}
                onValueChange={() => toggle(row.key)}
                disabled={saving}
              />
            </View>
          );
        })}
      </View>

      <Text style={styles.eyebrow}>Reminder schedule</Text>
      <Text style={styles.sectionSub}>
        How long before an appointment its reminder goes out.
      </Text>
      <View style={styles.card}>
        <View style={styles.chipRow}>
          {REMINDER_PRESETS.map(m => {
            const active = String(m) === String(settings?.reminderLeadMinutes ?? '');
            return (
              <TouchableOpacity
                key={m}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => applyLeadMinutes(m)}
                disabled={saving}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {m < 60 ? `${m} min` : `${m / 60} hr`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.leadRow}>
          <View style={styles.switchTextCol}>
            <Text style={styles.switchTitle}>Custom lead time</Text>
            <Text style={styles.switchSub}>Anything from 5 to 1440 minutes</Text>
          </View>
          <TextInput
            style={styles.leadInput}
            value={leadText}
            onChangeText={setLeadText}
            onBlur={() => applyLeadMinutes(parseInt(leadText, 10))}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
      </View>
    </ScrollView>
  );

  const TAB_RENDERERS = {
    compose: renderCompose,
    history: renderHistory,
    settings: renderSettings,
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Notifications"
        subtitle={TAB_SUBTITLE[tab]}
        onBack={() => navigation.goBack()}
      />

      <View style={styles.tabBar}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <MCIcon name={t.icon} size={17} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              {t.key === 'history' && scheduledCount > 0 ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{scheduledCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {!settings ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {TAB_RENDERERS[tab]()}
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  tabBadge: {
    minWidth: 18, paddingHorizontal: 5, height: 18, borderRadius: 9,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  tabBadgeText: { fontSize: 10.5, fontWeight: '800', color: colors.white },

  eyebrow: {
    fontSize: 11, fontWeight: '800', color: colors.textMuted,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 2,
  },
  sectionSub: { fontSize: 12.5, color: colors.textMuted, marginBottom: 10, lineHeight: 18, marginTop: -4 },

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

  // Preview — deliberately reads like a notification shade card, not a form
  // field, so what you are looking at is unambiguous.
  previewCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: colors.borderStrong,
    shadowColor: colors.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
    width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  previewAppIcon: {
    width: 20, height: 20, borderRadius: 6,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  previewApp: { flex: 1, fontSize: 11.5, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.3 },
  previewTime: { fontSize: 11, color: colors.textMuted },
  previewTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 3 },
  previewBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  previewGhost: { color: colors.textMuted, fontStyle: 'italic' },
  previewNote: { fontSize: 11, color: colors.textMuted, marginTop: 8, marginBottom: 18, textAlign: 'center' },

  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  counter: { fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  inputMultiline: { height: 110, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: colors.textSecondary, marginBottom: 6, marginTop: 2 },
  tokenBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
    backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.border,
  },
  tokenBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // Collapsible config blocks
  section: {
    backgroundColor: colors.card, borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 640, alignSelf: 'center', overflow: 'hidden',
  },
  sectionOpen: { borderColor: colors.borderStrong },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sectionIcon: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  sectionHeadText: { flex: 1 },
  sectionName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  sectionSummary: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionSummaryWarn: { color: colors.danger, fontWeight: '600' },
  sectionBody: {
    paddingHorizontal: 14, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  hint: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },
  presetChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, backgroundColor: colors.primaryLight,
    borderWidth: 1, borderColor: colors.primary,
  },
  presetChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  scheduleRow: { flexDirection: 'row', gap: 10 },
  scheduleInput: { flex: 1, textAlign: 'center' },

  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 12, borderRadius: 12, marginTop: 8, marginBottom: 12,
    backgroundColor: colors.accentLight, borderWidth: 1, borderColor: colors.danger,
    width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  warnTextCol: { flex: 1, gap: 4 },
  warnText: { fontSize: 12.5, color: colors.textPrimary, lineHeight: 18 },
  warnLink: { fontSize: 12.5, fontWeight: '700', color: colors.primary },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, marginTop: 8,
    width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  sendHint: { fontSize: 11.5, color: colors.textMuted, textAlign: 'center', marginTop: 8 },

  // Recent broadcasts
  listSpinner: { paddingVertical: 18 },
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
  emptyBroadcasts: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyBroadcastsText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  emptyLink: { fontSize: 12.5, fontWeight: '700', color: colors.primary },

  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  switchRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  switchIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  switchIconWrapOff: { backgroundColor: colors.surfaceMuted },
  switchTextCol: { flex: 1 },
  switchTitle: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  switchSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  leadInput: {
    width: 76, textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10, paddingVertical: 10,
    fontSize: 15, fontWeight: '700', color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
});

export default NotificationAdminScreen;
