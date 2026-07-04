import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import useConsultationStore from '../store/consultationStore';
import { showError } from '../utils/toast';
import { SPACING, RADIUS } from '../constants/theme';
import useTheme from '../hooks/useTheme';

const DoctorNotesEditorScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { mode = 'create', recordId } = route.params || {};

  const records = useConsultationStore(s => s.doctorNotes);
  const addRecord = useConsultationStore(s => s.addDoctorNote);
  const updateRecord = useConsultationStore(s => s.updateDoctorNote);

  const existing = mode === 'edit' ? records.find(r => r.id === recordId) : null;
  const [text, setText] = useState(existing?.content || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      if (mode === 'edit' && recordId) {
        await updateRecord(recordId, trimmed);
      } else {
        await addRecord(trimmed);
      }
      navigation.goBack();
    } catch (err) {
      showError(err?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={mode === 'edit' ? 'Edit Doctor Note' : 'Doctor Notes'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editorWrap}>
          <View style={styles.labelRow}>
            <MCIcon name="note-text-outline" size={18} color={colors.primary} />
            <Text style={styles.labelText}>Doctor Notes</Text>
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your clinical notes about the consultation…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            autoFocus
            value={text}
            onChangeText={setText}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, (!text.trim() || saving) && styles.btnDisabled]}
            activeOpacity={0.85}
            disabled={!text.trim() || saving}
            onPress={handleSave}>
            <MCIcon name="content-save-outline" size={20} color={colors.white} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default DoctorNotesEditorScreen;

const makeStyles = colors => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1 },
  editorWrap: { flex: 1, padding: SPACING.lg, paddingBottom: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  labelText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 24,
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
    textAlignVertical: 'top',
  },
  footer: { padding: SPACING.lg },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: RADIUS.md,
    backgroundColor: colors.primary,
  },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },
});
