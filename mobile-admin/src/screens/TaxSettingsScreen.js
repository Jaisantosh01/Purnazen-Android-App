import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import { showAlert } from '../utils/alert';

/**
 * GST configuration.
 *
 * One rate, applied to the consultation fee. Bookings snapshot the rate in
 * force when they were made, so saving a new value here only affects
 * appointments booked from now on — existing quotes and receipts are untouched.
 */
const PRESETS = [0, 5, 12, 18, 28];

// The sample the preview line is worked out on — a round number keeps the
// arithmetic obvious at a glance.
const PREVIEW_FEE = 1000;

const round2 = value => Math.round(((Number(value) || 0) + Number.EPSILON) * 100) / 100;
// Money pads to paise once it has any…
const formatAmount = value => {
  const n = round2(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};
// …a rate keeps only the decimals it actually has, so 12.5 reads "12.5%".
const formatPercent = value => String(round2(value));

const TaxSettingsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [gstPercentage, setGstPercentage] = useState(null);
  const [gstText, setGstText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.TAX_CONFIG)
      .then(res => {
        const value = Number(res?.data?.gstPercentage) || 0;
        setGstPercentage(value);
        setGstText(formatPercent(value));
      })
      .catch(() => showAlert('Error', 'Failed to load GST configuration'))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(
    value => {
      setSaving(true);
      apiClient
        .put(ENDPOINTS.TAX_CONFIG, { gstPercentage: value })
        .then(res => {
          const saved = Number(res?.data?.gstPercentage) || 0;
          setGstPercentage(saved);
          setGstText(formatPercent(saved));
        })
        .catch(() => {
          showAlert('Error', 'Failed to save GST configuration');
          // Put the field back to the stored value so the screen never shows a
          // rate that isn't actually in force.
          setGstText(formatPercent(gstPercentage ?? 0));
        })
        .finally(() => setSaving(false));
    },
    [gstPercentage],
  );

  const apply = useCallback(
    value => {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        showAlert('Invalid value', 'GST must be between 0 and 100 percent.');
        setGstText(formatPercent(gstPercentage ?? 0));
        return;
      }
      const rounded = round2(value);
      setGstText(formatPercent(rounded));
      // Blur fires whether or not the number changed — don't PUT a no-op.
      if (rounded === gstPercentage) return;
      save(rounded);
    },
    [gstPercentage, save],
  );

  const preview = useMemo(() => {
    const pct = Number(gstPercentage) || 0;
    const gst = round2((PREVIEW_FEE * pct) / 100);
    return { gst, total: round2(PREVIEW_FEE + gst) };
  }, [gstPercentage]);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="GST"
        subtitle="Tax applied to consultation fees"
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.eyebrow}>GST rate</Text>
            <Text style={styles.sectionSub}>
              Charged on top of every consultation fee. Set it to 0 to stop charging GST.
            </Text>

            <View style={styles.card}>
              <View style={styles.chipRow}>
                {PRESETS.map(p => {
                  const active = p === gstPercentage;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => apply(p)}
                      disabled={saving}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {p}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.rateRow}>
                <View style={styles.rateTextCol}>
                  <Text style={styles.rateTitle}>Custom rate</Text>
                  <Text style={styles.rateSub}>Anything from 0 to 100 percent</Text>
                </View>
                <View style={styles.rateInputWrap}>
                  <TextInput
                    style={styles.rateInput}
                    value={gstText}
                    onChangeText={setGstText}
                    onBlur={() => apply(parseFloat(gstText))}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    editable={!saving}
                  />
                  <Text style={styles.ratePercent}>%</Text>
                </View>
              </View>
            </View>

            <Text style={styles.eyebrow}>Preview</Text>
            <Text style={styles.sectionSub}>
              How a ₹{PREVIEW_FEE} consultation is billed at the current rate.
            </Text>
            <View style={styles.card}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Consultation Fee</Text>
                <Text style={styles.previewValue}>₹{formatAmount(PREVIEW_FEE)} + Tax</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>
                  GST ({formatPercent(gstPercentage ?? 0)}%)
                </Text>
                <Text style={styles.previewValue}>+ ₹{formatAmount(preview.gst)}</Text>
              </View>
              <View style={[styles.previewRow, styles.previewTotalRow]}>
                <Text style={styles.previewTotalLabel}>Total Amount</Text>
                <Text style={styles.previewTotalValue}>₹{formatAmount(preview.total)}</Text>
              </View>
            </View>

            <View style={styles.noteRow}>
              <MCIcon name="information-outline" size={16} color={colors.textMuted} />
              <Text style={styles.note}>
                Appointments already booked keep the rate they were quoted at — changing
                this only affects new bookings.
              </Text>
            </View>

            {saving ? (
              <View style={styles.savingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.savingText}>Saving…</Text>
              </View>
            ) : null}
          </ScrollView>
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  chipTextActive: { color: colors.white },

  rateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12,
  },
  rateTextCol: { flex: 1 },
  rateTitle: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  rateSub: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  rateInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rateInput: {
    width: 76, textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10, paddingVertical: 10,
    fontSize: 15, fontWeight: '700', color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  ratePercent: { fontSize: 15, fontWeight: '700', color: colors.textMuted },

  previewRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 7,
  },
  previewLabel: { fontSize: 13, color: colors.textSecondary },
  previewValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  previewTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 11 },
  previewTotalLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  previewTotalValue: { fontSize: 16, fontWeight: '800', color: colors.primary },

  noteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    width: '100%', maxWidth: 640, alignSelf: 'center',
  },
  note: { flex: 1, fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },

  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  savingText: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
});

export default TaxSettingsScreen;
