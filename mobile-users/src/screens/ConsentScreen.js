import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { showConfirm } from '../utils/alert';
import consentService from '../services/consentService';
import useTheme from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';
import AppToggle from '../components/AppToggle';

// The three GDPR consent types the backend recognises.
const CONSENTS = [
  {
    key: 'scan_storage',
    icon: 'cloud-lock-outline',
    title: 'Store my scans',
    desc: 'Save your face/tongue photos and results so you can track progress over time. Required to run a scan.',
  },
  {
    key: 'ai_training',
    icon: 'brain',
    title: 'Improve the AI',
    desc: 'Allow your anonymised scans to help improve our analysis models. Optional — you can turn this off anytime.',
  },
  {
    key: 'gdpr_data',
    icon: 'file-document-outline',
    title: 'Data processing',
    desc: 'Consent to processing your data to provide personalised wellness recommendations.',
  },
];

const ConsentScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [state, setState] = useState({});      // { type: granted }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);  // type currently saving

  const load = useCallback(async () => {
    try {
      setState(await consentService.getConsents());
    } catch (e) {
      setState({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyToggle = async (key, next) => {
    setSaving(key);
    setState(prev => ({ ...prev, [key]: next })); // optimistic
    try {
      await consentService.setConsent(key, next);
    } catch (e) {
      setState(prev => ({ ...prev, [key]: !next })); // revert
    } finally {
      setSaving(null);
    }
  };

  // Turning a consent OFF is consequential — confirm first, and spell out the
  // scan-storage impact (new scans can't be saved without it).
  const toggle = (key, next) => {
    if (!next) {
      const meta = CONSENTS.find(c => c.key === key);
      showConfirm(
        `Turn off "${meta?.title ?? 'this consent'}"?`,
        key === 'scan_storage'
          ? "New face & tongue scans won't be saved and progress tracking stops until you turn this back on. Your existing scans stay untouched."
          : 'You can turn this back on anytime.',
        () => applyToggle(key, false),
        { confirmLabel: 'Turn off', destructive: true },
      );
      return;
    }
    applyToggle(key, true);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Privacy & Data" subtitle="Manage your consents" backBehavior="popToRoot" />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={styles.intro}>
            You're in control of your data. Manage what Purnazen can store and use below — changes
            take effect immediately.
          </Text>

          {CONSENTS.map(c => (
            <View key={c.key} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.iconWrap}>
                  <MCIcon name={c.icon} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{c.title}</Text>
                </View>
                {saving === c.key ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <AppToggle
                    value={!!state[c.key]}
                    onValueChange={(v) => toggle(c.key, v)}
                  />
                )}
              </View>
              <Text style={styles.cardDesc}>{c.desc}</Text>
            </View>
          ))}

          <View style={styles.note}>
            <MCIcon name="information-outline" size={16} color={colors.textMuted} />
            <Text style={styles.noteText}>
              Turning off “Store my scans” means new scans can't be saved. You can delete individual
              scans anytime from Scan History.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default ConsentScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cardDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 10 },
  note: { flexDirection: 'row', gap: 8, marginTop: 8, paddingHorizontal: 4 },
  noteText: { flex: 1, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
});
