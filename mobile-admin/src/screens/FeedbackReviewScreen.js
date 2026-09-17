/**
 * Patient feedback review — what patients said after their therapy sessions,
 * with their pain score before and after, and a reply from staff.
 *
 * Shared between the doctor app (their own patients, reply as the doctor) and
 * the admin app (everyone, reply as the clinic); the reviewer comes from
 * feedbackReviewService.REVIEWER. Keep the two copies identical.
 *
 * Route params: { patientId?, patientName? } narrows the list to one patient.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import useTheme from '../hooks/useTheme';
import feedbackReviewService, { REVIEWER } from '../services/feedbackReviewService';
import { showError, showSuccess } from '../utils/toast';

const FILTERS = [
  { key: 'pending', label: 'Awaiting reply' },
  { key: 'reviewed', label: 'Replied' },
  { key: 'all', label: 'All' },
];
const MAX_REPLY = 1000;
const ownReplyKey = REVIEWER === 'doctor' ? 'doctorFeedback' : 'adminFeedback';

const formatDate = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "7 → 3" plus a tone: relief (green), worse (red), same (neutral). */
export const painSummary = (before, after) => {
  if (before == null && after == null) return null;
  if (before == null || after == null) {
    return { text: `Pain ${before ?? after}/10`, tone: 'neutral' };
  }
  const tone = after < before ? 'better' : after > before ? 'worse' : 'neutral';
  return { text: `Pain ${before} → ${after}`, tone };
};

const FeedbackCard = ({ item, styles, colors, onReply }) => {
  const pain = painSummary(item.painBefore, item.painAfter);
  const toneColor = {
    better: colors.success || '#16A34A',
    worse: colors.danger || '#DC2626',
    neutral: colors.textSecondary,
  };
  const ownReply = item[ownReplyKey];
  const otherReply = REVIEWER === 'admin' ? item.doctorFeedback : null;
  const remark = item.userFeedback || item.userPainDescription;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.patientName || '?').trim().charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardTopText}>
          <Text style={styles.patient} numberOfLines={1}>{item.patientName || 'Patient'}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.programTitle, formatDate(item.createdAt)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {pain ? (
          <View style={[styles.painChip, { borderColor: toneColor[pain.tone] }]}>
            <Text style={[styles.painText, { color: toneColor[pain.tone] }]}>{pain.text}</Text>
          </View>
        ) : null}
      </View>

      {remark ? (
        <Text style={styles.remark}>“{remark}”</Text>
      ) : (
        <Text style={styles.noRemark}>Pain score only — no written remark.</Text>
      )}

      {otherReply ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>Doctor{item.doctorFeedbackByName ? ` · ${item.doctorFeedbackByName}` : ''}</Text>
          <Text style={styles.replyText}>{otherReply}</Text>
        </View>
      ) : null}

      {ownReply ? (
        <View style={[styles.replyBox, styles.ownReply]}>
          <Text style={styles.replyLabel}>Your reply</Text>
          <Text style={styles.replyText}>{ownReply}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.replyBtn}
        onPress={() => onReply(item)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={ownReply ? 'Edit reply' : 'Reply to patient'}
      >
        <MCIcon name={ownReply ? 'pencil-outline' : 'reply-outline'} size={16} color={colors.primary} />
        <Text style={styles.replyBtnText}>{ownReply ? 'Edit reply' : 'Reply'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const FeedbackReviewScreen = ({ route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const patientId = route?.params?.patientId;
  const patientName = route?.params?.patientName;

  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (status, { refresh = false } = {}) => {
      const id = ++requestId.current;
      refresh ? setRefreshing(true) : setLoading(true);
      setError('');
      try {
        const data = await feedbackReviewService.list({ status, patientId, offset: 0 });
        if (id !== requestId.current) return;
        setItems(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        if (id === requestId.current) setError(e.message || 'Could not load feedback');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [patientId],
  );

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  const loadMore = async () => {
    if (loadingMore || loading || items.length >= total) return;
    setLoadingMore(true);
    try {
      const data = await feedbackReviewService.list({ status: filter, patientId, offset: items.length });
      setItems(prev => [...prev, ...(data.items || [])]);
      setTotal(data.total || 0);
    } catch {
      // A failed page leaves the list as it is; pull to refresh retries.
    } finally {
      setLoadingMore(false);
    }
  };

  const openReply = item => {
    setEditing(item);
    setDraft(item[ownReplyKey] || '');
  };

  const saveReply = async () => {
    const text = draft.trim();
    if (!text || !editing) return;
    setSaving(true);
    try {
      const updated = await feedbackReviewService.reply(editing.id, text);
      setItems(prev => {
        const next = prev.map(i => (i.id === editing.id ? { ...i, ...updated } : i));
        // A reply moves the record out of "Awaiting reply".
        return filter === 'pending' ? next.filter(i => i.id !== editing.id) : next;
      });
      if (filter === 'pending') setTotal(t => Math.max(0, t - 1));
      setEditing(null);
      showSuccess('Reply saved — the patient sees it in Session History.');
    } catch (e) {
      showError(e.message || 'Could not save the reply');
    } finally {
      setSaving(false);
    }
  };

  const subtitle = patientName
    ? `Feedback from ${patientName}`
    : REVIEWER === 'doctor'
      ? 'What your patients said after their sessions'
      : 'What patients said after their sessions';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Patient Feedback" subtitle={subtitle} />

      <View style={styles.filters}>
        {FILTERS.map(f => {
          const active = f.key === filter;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filter, active && styles.filterActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <FeedbackCard item={item} styles={styles} colors={colors} onReply={openReply} />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(filter, { refresh: true })}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            total > 0 ? <Text style={styles.count}>{total} {total === 1 ? 'record' : 'records'}</Text> : null
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.primary} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MCIcon
                name={error ? 'wifi-alert' : 'message-check-outline'}
                size={44}
                color={colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {error ? 'Could not load feedback' : filter === 'pending' ? 'All caught up' : 'No feedback yet'}
              </Text>
              <Text style={styles.emptyText}>
                {error || (filter === 'pending'
                  ? 'Every remark has a reply. New ones appear here after patients finish a session.'
                  : 'Remarks and pain scores appear here after patients finish a session.')}
              </Text>
            </View>
          }
        />
      )}

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Reply to {editing?.patientName || 'patient'}</Text>
            {editing?.userFeedback ? (
              <Text style={styles.sheetQuote} numberOfLines={3}>“{editing.userFeedback}”</Text>
            ) : null}
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Advice, encouragement or a follow-up step…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={MAX_REPLY}
              autoFocus
              textAlignVertical="top"
              accessibilityLabel="Reply"
            />
            <Text style={styles.counter}>{draft.length}/{MAX_REPLY}</Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)} disabled={saving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!draft.trim() || saving) && styles.saveBtnDisabled]}
                onPress={saveReply}
                disabled={!draft.trim() || saving}
              >
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveText}>Send reply</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const makeStyles = colors =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
    filter: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    filterTextActive: { color: colors.white },
    list: { padding: 16, paddingBottom: 40, gap: 12, flexGrow: 1 },
    count: { fontSize: 12, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardTopText: { flex: 1 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
    patient: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    painChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    painText: { fontSize: 12, fontWeight: '700' },
    remark: { fontSize: 14, lineHeight: 20, color: colors.textPrimary },
    noRemark: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
    replyBox: { backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: 10, gap: 2 },
    ownReply: { backgroundColor: colors.primaryFaint || colors.surfaceMuted },
    replyLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
    replyText: { fontSize: 13.5, lineHeight: 19, color: colors.textPrimary },
    replyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
    replyBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13.5 },
    more: { marginVertical: 12 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
    modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 32,
      gap: 10,
    },
    sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    sheetQuote: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' },
    input: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      fontSize: 15,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceMuted,
    },
    counter: { alignSelf: 'flex-end', fontSize: 11, color: colors.textMuted },
    sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    cancelText: { fontWeight: '700', color: colors.textSecondary },
    saveBtn: {
      flex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: colors.white, fontWeight: '800' },
  });

export default FeedbackReviewScreen;
